#import <objc/runtime.h>
#import <Foundation/Foundation.h>
#import <React/RCTHTTPRequestHandler.h>

@implementation RCTHTTPRequestHandler (AuthenticationChallengeExtension)

/* The load method is called by the Objective-C runtime when the class is loaded into memory,
 * it happens early in the application's lifecycle.
 */
+ (void)load {
  // dispatch_once avoids the load method to run twice
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    NSLog(@"[RCTHTTPRequestHandler extension] It will swizzle authentication challenge on this data delegate.");
    Class class = [RCTHTTPRequestHandler class];
    
    SEL originalSelector = @selector(URLSession:task:didReceiveChallenge:completionHandler:);
    SEL swizzledSelector = @selector(authenticationChallenge_URLSession:task:didReceiveChallenge:completionHandler:);
    
    Method originalMethod = class_getInstanceMethod(class, originalSelector);
    Method swizzledMethod = class_getInstanceMethod(class, swizzledSelector);
    
    BOOL didAddMethod = class_addMethod(class, originalSelector, method_getImplementation(swizzledMethod), method_getTypeEncoding(swizzledMethod));
    
    if (didAddMethod) {
      class_replaceMethod(class, swizzledSelector, method_getImplementation(originalMethod), method_getTypeEncoding(originalMethod));
    } else {
      method_exchangeImplementations(originalMethod, swizzledMethod);
    }
  });
}

/* This method extends the RCTHTTPRequestHandler by intercepting the authentication challenge,
 * and gives to it a custom behavior regarding allowing or denying connections.
 * The current implementation of RCTHTTPRequestHandler doesn't provide an implementation for
 * the authentication challenge event, therefore we don't risk to interfere with React Native behavior.
 * See the original code:
 * https://github.com/facebook/react-native/blob/v0.72.5/packages/react-native/Libraries/Network/RCTHTTPRequestHandler.mm
 *
 * It worths a clarification regarding the role of RCTHTTPRequestHandler in the context of the
 * iOS network framework. It plays the role of a NSURLSessionDelegate of the kind NSURLSessionDataDelegate.
 * A delegate is a callback injected in the NSURLSession, and aims to intercept each phase of a connection.
 * In React Native, when a session is created, this delegate is injected in.
 */
- (void)authenticationChallenge_URLSession:(NSURLSession *)session
                                      task:(NSURLSessionTask *)task
                       didReceiveChallenge:(NSURLAuthenticationChallenge *)challenge
                         completionHandler:(void (^)(NSURLSessionAuthChallengeDisposition disposition, NSURLCredential *credential))completionHandler {
  // Set of allowed domains
  NSSet *allowedDomains = [self getAllowedDomains];
  // Check if the challenge is of type ServerTrust
  if ([challenge.protectionSpace.authenticationMethod isEqualToString:NSURLAuthenticationMethodServerTrust]) {
    // Check if the host is an allowed domain
    if ([self checkValidityOfHost:challenge.protectionSpace.host allowedInDomains:allowedDomains]) {
      // Check if proceed with the original authentication handling
      if ([self checkValidityOfTrust:challenge.protectionSpace.serverTrust]) {
        // The challenge is of type ServerTrust, the host is allowed and the certificate is trust worthy
        // Create the credential and completes the delegate
        NSURLCredential *credential = [NSURLCredential credentialForTrust:challenge.protectionSpace.serverTrust];
        completionHandler(NSURLSessionAuthChallengeUseCredential, credential);
      } else {
        // Certificate is invalid, cancelling authentication
        NSLog(@"Invalid certificate for Domain %@. Cancelling authentication.", challenge.protectionSpace.host);
        // Cancel the authentication challenge
        completionHandler(NSURLSessionAuthChallengeCancelAuthenticationChallenge, nil);
      }
    } else {
      // Host is not allowed, cancelling authentication
      NSLog(@"Host domain %@ is not allowed. Cancelling authentication.", challenge.protectionSpace.host);
      // Cancel the authentication challenge
      completionHandler(NSURLSessionAuthChallengeCancelAuthenticationChallenge, nil);
    }
  } else {
    // Trust is not of type ServerTrust, proceeding with default challenge, if any
    NSLog(@"Not ServerTrust challenge. Calling default authentication challenge.");
    // For other authentication methods, call the original implementation
    [self authenticationChallenge_URLSession:session task:task didReceiveChallenge:challenge completionHandler:completionHandler];
  }
}

- (BOOL)checkValidityOfTrust:(SecTrustRef)serverTrust {
  CFErrorRef error = NULL;
  BOOL isValid = SecTrustEvaluateWithError(serverTrust, &error);
  
  if (!isValid) {
    /* This is a casting a core foundation class, CFErrorRef, to an Objective-C class, NSError.
     * It means the new error instance will be managed by Objective-C, which will control the
     * memory for this object, making our work easier.
     */
    NSError *nsError = (__bridge_transfer NSError *)error;
    NSLog(@"Trust evaluation failed: %@", nsError);
  }
  
  return isValid;
}

- (NSSet *)getAllowedDomains {
  NSDictionary *infoDictionary = [[NSBundle mainBundle] infoDictionary];
  NSDictionary *appTransportSecurity = [infoDictionary objectForKey:@"NSAppTransportSecurity"];
  NSDictionary *pinnedDomains = [appTransportSecurity objectForKey:@"NSPinnedDomains"];
  
  NSMutableSet *allowedDomains = [NSMutableSet set];
  
  [pinnedDomains enumerateKeysAndObjectsUsingBlock:^(NSString *domain, NSDictionary *domainInfo, BOOL *stop) {
    /* Throw an error if the domain value is an empty string. This validation is important
     * because the pinned certificate for empty domain has no effect in the ATS and in
     * addition we don't want to allow a broader domain, quite the opposity.
     */
    if (domain.length == 0) {
      NSString *errorMessage = @"Error: Empty domain found in NSPinnedDomains";
      NSLog(@"%@", errorMessage);
      // It intentionally breaks the application
      // It must be catched in the QA or during development
      @throw [NSException exceptionWithName:NSInvalidArgumentException
                                     reason:errorMessage
                                   userInfo:nil];
    }
    
    /* Throw an error if the domain value is invalid by containing a wildcard prefix.
     * This is invalid because we already use the "*." prefix internally to make
     * subdomain validation. One must configure apropriatelly the NSPinnedDomains key
     * in the Info.plist file.
     */
    if ([domain hasPrefix:@"*."]) {
      NSString *errorMessage = @"Error: Domain with wildcard found in NSPinnedDomains\n\tUse the NSIncludesSubdomains property to allow subdomains";
      NSLog(@"%@", errorMessage);
      // It intentionally breaks the application
      // It must be catched in the QA or during development
      @throw [NSException exceptionWithName:NSInvalidArgumentException
                                     reason:errorMessage
                                   userInfo:nil];
    }
    
    // Check if subdomains are included
    if ([[domainInfo objectForKey:@"NSIncludesSubdomains"] boolValue]) {
      // If subdomains are included, add a wildcard entry
      [allowedDomains addObject:[NSString stringWithFormat:@"*.%@", domain]];
    } else {
      [allowedDomains addObject:domain];
    }
  }];
  
  return [allowedDomains copy];
}

- (BOOL)checkValidityOfHost:(NSString *)host allowedInDomains:(NSSet *)allowedDomains {
  for (NSString *allowedDomain in allowedDomains) {
    if ([allowedDomain hasPrefix:@"*."]) {
      /* A domain is only valid for the immediate subdomain.
       * Take for example the "hathor.network" domain, it can only
       * validate a domain like "mainnet.hathor.network", and must
       * invalidate a domain like "node1.mainnet.hathor.network".
       *
       * This validation only plays by the rules of ATS certification pinning.
       * See: https://developer.apple.com/news/?id=g9ejcf8y
       */
      NSString *domain = [allowedDomain substringFromIndex:2];

      NSArray *hostSegments = [host componentsSeparatedByString:@"."];
      NSArray *allowedDomainSegments = [domain componentsSeparatedByString:@"."];
      
      NSInteger hostSegmentCount = [hostSegments count];
      NSInteger allowedDomainSegmentCount = [allowedDomainSegments count];
      
      // The domain should have one less segment only
      if (hostSegmentCount - allowedDomainSegmentCount > 1) {
        // More than one level of subdomain, not valid
        return NO;
      }

      // Start the suffix by the dot
      NSString *domainSuffix = [allowedDomain substringFromIndex:1];
      if ([host hasSuffix:domainSuffix]) {
        // It contains the suffix
        return YES;
      }
      
      if ([host isEqualToString:domain]) {
        // It contains itself
        return YES;
      }
    } else if ([host isEqualToString:allowedDomain]) {
      return YES;
    }
  }
  return NO;
}

@end
