#import <Foundation/Foundation.h>

@class LynxContext;

NS_ASSUME_NONNULL_BEGIN

/** Process observation outlives modules. Snapshot and weak registry share one lock. */
@interface LALAppStateStore : NSObject
+ (instancetype)sharedStore;
- (NSDictionary *)snapshot;
- (void)registerContext:(LynxContext *)context;
- (void)unregisterContext:(LynxContext *)context;
@end

NS_ASSUME_NONNULL_END
