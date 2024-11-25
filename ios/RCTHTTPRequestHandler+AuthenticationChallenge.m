#import <objc/runtime.h>
#import <Foundation/Foundation.h>
#import <React/RCTHTTPRequestHandler.h>
#import <Security/Security.h>

/**
 * There will be only one instance of this class at runtime according to the React Native code.
 * This provides a good opportunity to cache data on the class itself.
 */
@implementation RCTHTTPRequestHandler (AuthenticationChallengeExtension)

// Cache allocated certificates on memory to hold them through the class lifecycle.
static NSMutableDictionary<NSString *, id> *_certificateCache = nil;
// Cache a set of allowed domains
static NSSet *_cachedAllowedDomains = nil;

/**
 * The load method is called by the Objective-C runtime when the class is loaded into memory,
 * it happens early in the application's lifecycle.
 */
+ (void)load {
  // dispatch_once avoids the load method to run twice
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    Class class = [RCTHTTPRequestHandler class];
    
    NSLog(@"[RCTHTTPRequestHandler (AuthenticationChallengeExtension)] Initializing _certificateCache.");
    _certificateCache = [NSMutableDictionary new];

    NSLog(@"[RCTHTTPRequestHandler (AuthenticationChallengeExtension)] Swizzling authentication challenge handler on session scope.");
    SEL originalSelector = @selector(URLSession:didReceiveChallenge:completionHandler:);
    SEL swizzledSelector = @selector(authenticationChallenge_URLSession:didReceiveChallenge:completionHandler:);
    
    Method originalMethod = class_getInstanceMethod(class, originalSelector);
    Method swizzledMethod = class_getInstanceMethod(class, swizzledSelector);
    
    BOOL didAddMethod = class_addMethod(class, originalSelector, method_getImplementation(swizzledMethod), method_getTypeEncoding(swizzledMethod));
    
    if (didAddMethod) {
      class_replaceMethod(class, swizzledSelector, method_getImplementation(originalMethod), method_getTypeEncoding(originalMethod));
    } else {
      method_exchangeImplementations(originalMethod, swizzledMethod);
    }

    NSLog(@"[RCTHTTPRequestHandler (AuthenticationChallengeExtension)] Swizzling the dealloc method.");
    SEL deallocOriginalSelector = NSSelectorFromString(@"dealloc");
    SEL deallocSwizzledSelector = @selector(swizzled_dealloc);
    
    Method deallocOriginalMethod = class_getInstanceMethod(class, deallocOriginalSelector);
    Method deallocSwizzledMethod = class_getInstanceMethod(class, deallocSwizzledSelector);
    
    if (!class_addMethod(class, deallocOriginalSelector, method_getImplementation(deallocSwizzledMethod), method_getTypeEncoding(deallocSwizzledMethod))) {
      method_exchangeImplementations(deallocOriginalMethod, deallocSwizzledMethod);
    } else {
      class_replaceMethod(class, deallocSwizzledSelector, method_getImplementation(deallocOriginalMethod), method_getTypeEncoding(deallocOriginalMethod));
    }
  });
}

/**
 * This method extends the RCTHTTPRequestHandler by intercepting the authentication challenge,
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
                       didReceiveChallenge:(NSURLAuthenticationChallenge *)challenge
                         completionHandler:(void (^)(NSURLSessionAuthChallengeDisposition disposition, NSURLCredential *credential))completionHandler {
  static int _counter = 0;
  NSLog(@"Session handler call %i, host %@.", _counter, challenge.protectionSpace.host);
  _counter++;
  
  if ([challenge.protectionSpace.authenticationMethod isEqualToString:NSURLAuthenticationMethodServerTrust]) {
    NSArray *anchorCertificates = [self getAnchorCertificates];
    // Set resource certificates to the trust entity to be evaluated
    OSStatus status = SecTrustSetAnchorCertificates(challenge.protectionSpace.serverTrust, (__bridge CFArrayRef)anchorCertificates);
    if (status == errSecSuccess) {
      /* The following method signs to the evalution if the system bundle certificates must be taken in consideration
       * when evaluating the trust entity. The second param determines this behavior, set YES to constrain the evaluation
       * to the resource certificates only, and NO to allow system bundle certificates.
       */
      SecTrustSetAnchorCertificatesOnly(challenge.protectionSpace.serverTrust, YES);
      // A set of allowed domains
      NSSet *allowedDomains = [self getCachedAllowedDomains];
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
      CFStringRef errorMessage = SecCopyErrorMessageString(status, NULL);
      NSLog(@"Certificate not set to the trust entity. Reason: %@", (__bridge NSString *)errorMessage);
      // Cancel the authentication challenge
      completionHandler(NSURLSessionAuthChallengeCancelAuthenticationChallenge, nil);
    }
  } else {
    // Trust is not of type ServerTrust, proceeding with default challenge, if any
    NSLog(@"Not ServerTrust challenge. Calling default authentication challenge.");
    completionHandler(NSURLSessionAuthChallengePerformDefaultHandling, nil);
  }
}

/**
 * Fetch anchor certificates either from the resources or the cache.
 */
- (NSArray *)getAnchorCertificates {
  // Load root certificates from resources in the first run and from the cache afterwards
  SecCertificateRef hathor_root_ca_1 = [self getCert:@"hathor_network_root_ca_1"];
  SecCertificateRef hathor_root_ca_2 = [self getCert:@"hathor_network_root_ca_2"];
  
  // Create an NSArray with the certificates
  NSArray *certArray = @[(__bridge id)hathor_root_ca_1, (__bridge id)hathor_root_ca_2];
  
  return certArray;
}

/**
 * The certificate must be of type .der and should be in DER encoding.
 */
- (SecCertificateRef)getCert:(NSString *)certFilename {
  @synchronized (_certificateCache) {
    id cachedCert = [_certificateCache objectForKey:certFilename];;
    if (cachedCert) {
      return (__bridge SecCertificateRef)cachedCert;
    }
    
    NSString *certPath = [[NSBundle mainBundle] pathForResource:certFilename ofType:@"der"];
    NSData *certData = [NSData dataWithContentsOfFile:certPath];
    
    if (!certData) {
      @throw [NSException exceptionWithName:NSInternalInconsistencyException
                                     reason:[NSString stringWithFormat:@"Certificate file %@.der not found", certFilename]
                                   userInfo:nil];
    }
    
    SecCertificateRef cert = SecCertificateCreateWithData(NULL, (__bridge CFDataRef)certData);
    if (!cert) {
      @throw [NSException exceptionWithName:NSInternalInconsistencyException
                                     reason:[NSString stringWithFormat:@"Error on parsing the %@ certificate", certFilename]
                                   userInfo:nil];
    }
    
    [_certificateCache setObject:(__bridge id)cert forKey:certFilename];
    return cert;
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

- (NSSet *)getCachedAllowedDomains {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
      _cachedAllowedDomains = [self getAllowedDomains];
  });
  return _cachedAllowedDomains;
}

- (NSSet *)getAllowedDomains {
  NSDictionary *infoDictionary = [[NSBundle mainBundle] infoDictionary];
  NSDictionary *appTransportSecurity = [infoDictionary objectForKey:@"NSAppTransportSecurity"];
  if (!appTransportSecurity) {
    @throw [NSException exceptionWithName:NSInternalInconsistencyException
                                   reason:@"NSAppTransportSecurity not found in Info.plist"
                                 userInfo:nil];
  }
  NSDictionary *pinnedDomains = [appTransportSecurity objectForKey:@"NSPinnedDomains"];
  if (!pinnedDomains) {
    @throw [NSException exceptionWithName:NSInternalInconsistencyException
                                   reason:@"NSPinnedDomains not found in NSAppTransportSecurity in Info.plist"
                                 userInfo:nil];
  }
  
  NSMutableSet *allowedDomains = [NSMutableSet set];
  
  [pinnedDomains enumerateKeysAndObjectsUsingBlock:^(NSString *domain, NSDictionary *domainInfo, BOOL *stop) {
    /* Throw an error if the domain value is an empty string. This validation is important
     * because the pinned certificate for empty domain has no effect in the ATS and in
     * addition we don't want to allow a broader domain, quite the opposity.
     */
    if (domain.length == 0) {
      NSString *errorMessage = @"Error: Empty domain found in NSPinnedDomains in Info.plist";
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

/**
 * Release each allocated certificate in memory and clean the cache dictionary in a thread safe manner.
 */
- (void)clearCertificateCache {
  NSLog(@"[RCTHTTPRequestHandler (AuthenticationChallengeExtension)] Clearing the certificate cache.");
  @synchronized(_certificateCache) {
    for (id cert in _certificateCache.allValues) {
      CFRelease((__bridge SecCertificateRef)cert);
    }
    [_certificateCache removeAllObjects];
  }
}

/**
 * As this class has only one instance and it will probably live until the user quits the app,
 * it will probably never be called. However, we shouldn't worry much about it because
 * the app memory will be released anyway after quit.
 */
- (void)swizzled_dealloc {
    [self clearCertificateCache];
    [self swizzled_dealloc]; // This will call the original dealloc method
}

@end
