/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
