#import "LynxAppLifecycleModule.h"
#import "LALAppStateStore.h"

@interface LynxAppLifecycleModule ()
@property(nonatomic, weak) LynxContext *lynxContext;
@end

@implementation LynxAppLifecycleModule

+ (NSString *)name {
    return @"LynxAppLifecycleModule";
}

+ (NSDictionary<NSString *, NSString *> *)methodLookup {
    return @{
        @"getState" : NSStringFromSelector(@selector(getState)),
        @"getEventName" : NSStringFromSelector(@selector(getEventName)),
    };
}

- (instancetype)initWithLynxContext:(LynxContext *)context {
    self = [super init];
    if (self) {
        _lynxContext = context;
        [[LALAppStateStore sharedStore] registerContext:context];
    }
    return self;
}

- (void)destroy {
    LynxContext *context = self.lynxContext;
    if (context)
        [[LALAppStateStore sharedStore] unregisterContext:context];
    self.lynxContext = nil;
}

- (void)dealloc {
    LynxContext *context = _lynxContext;
    if (context)
        [[LALAppStateStore sharedStore] unregisterContext:context];
}

// Preserve the synchronous NSDictionary bridge return and ARC-neutral selector name.
- (NSDictionary *)getState {
    return [[LALAppStateStore sharedStore] snapshot];
}

- (NSString *)getEventName {
    return @"lynxappstatechange";
}

@end
