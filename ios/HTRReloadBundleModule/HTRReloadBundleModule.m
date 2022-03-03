//
//  HTRReloadBundleModule.m
//  HathorMobile
//
//  Created by Andre Cardoso on 24/02/22.
//  Copyright © 2022 Facebook. All rights reserved.
//

// HTRReloadBundleModule.m
#import "HTRReloadBundleModule.h"

@implementation HTRReloadBundleModule

- (void)reloadBundle
{
    RCTTriggerReloadCommandListeners();
}

RCT_EXPORT_MODULE(HTRReloadBundleModule);
RCT_EXPORT_METHOD(restart) {
    if ([NSThread isMainThread]) {
        [self reloadBundle];
    } else {
        dispatch_sync(dispatch_get_main_queue(), ^{
            [self reloadBundle];
        });
    }
    return;
}
@end
