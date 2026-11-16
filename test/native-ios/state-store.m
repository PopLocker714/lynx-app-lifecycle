#import "LALAppStateStore.h"
#import <Lynx/LynxContext.h>
#import <UIKit/UIKit.h>

NSNotificationName const UIApplicationDidBecomeActiveNotification = @"active";
NSNotificationName const UIApplicationDidEnterBackgroundNotification = @"background";
NSNotificationName const UIApplicationDidFinishLaunchingNotification = @"launch";

@implementation UIApplication
+ (instancetype)sharedApplication {
    static UIApplication *application;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        application = [UIApplication new];
    });
    return application;
}
@end

@implementation LynxContext
- (instancetype)init {
    self = [super init];
    if (self)
        _events = [NSMutableArray new];
    return self;
}
- (void)sendGlobalEvent:(NSString *)name withParams:(NSArray *)params {
    NSCAssert([name isEqual:@"lynxappstatechange"], @"wire event name");
    [self.events addObject:params[0]];
}
@end

@interface LALAppStateStore (TestAccess)
- (void)startObserving;
- (void)publishState:(NSString *)state;
@end

static void Post(NSNotificationName name) {
    [NSNotificationCenter.defaultCenter postNotificationName:name object:nil];
}

int main(void) {
    @autoreleasepool {
        LALAppStateStore *store = [LALAppStateStore new];
        NSCAssert([[store snapshot][@"error"] isEqual:@"NOT_INITIALIZED"], @"readiness");
        LynxContext *first = [LynxContext new];
        LynxContext *second = [LynxContext new];
        [store registerContext:first];
        [store registerContext:second];
        UIApplication.sharedApplication.applicationState = UIApplicationStateBackground;
        [store startObserving];
        NSDictionary *initial = @{@"state" : @"background", @"generation" : @0};
        NSCAssert([[store snapshot] isEqual:initial], @"real initial background");
        NSCAssert([first.events.lastObject isEqual:initial], @"first context initial event");
        NSCAssert([second.events.lastObject isEqual:initial], @"second context initial event");
        Post(UIApplicationDidBecomeActiveNotification);
        NSCAssert(first.events.count == 2 && second.events.count == 2, @"multi-context fan-out");
        NSCAssert([first.events.lastObject isEqual:second.events.lastObject], @"same generation");
        Post(UIApplicationDidBecomeActiveNotification);
        NSCAssert(first.events.count == 2 && second.events.count == 2, @"dedup once per process");
        [store unregisterContext:first];
        Post(UIApplicationDidEnterBackgroundNotification);
        NSCAssert(first.events.count == 2 && second.events.count == 3, @"unregister");
        [store unregisterContext:second];
        Post(UIApplicationDidBecomeActiveNotification);
        LynxContext *recreated = [LynxContext new];
        [store registerContext:recreated];
        NSCAssert(([[store snapshot] isEqual:@{
                      @"state" : @"active",
                      @"generation" : @3
                  }]),
                  @"state survives absence of modules");
        Post(UIApplicationDidEnterBackgroundNotification);
        NSCAssert(([recreated.events.lastObject isEqual:@{
                      @"state" : @"background",
                      @"generation" : @4
                  }]),
                  @"recreated context receives current events");
        recreated.hasLynxViewDestroyed = YES;
        Post(UIApplicationDidBecomeActiveNotification);
        NSCAssert(recreated.events.count == 1, @"destroyed view gets no sends");
        [store unregisterContext:recreated];
        __weak LynxContext *weakContext;
        @autoreleasepool {
            LynxContext *temporary = [LynxContext new];
            weakContext = temporary;
            [store registerContext:temporary];
        }
        NSCAssert(weakContext == nil, @"registry does not retain contexts");
        dispatch_group_t readers = dispatch_group_create();
        for (NSInteger worker = 0; worker < 4; worker++) {
            dispatch_group_async(readers, dispatch_get_global_queue(QOS_CLASS_DEFAULT, 0), ^{
                for (NSInteger index = 0; index < 10000; index++) {
                    NSDictionary *snapshot = [store snapshot];
                    BOOL active = [snapshot[@"state"] isEqual:@"active"];
                    NSInteger generation = [snapshot[@"generation"] integerValue];
                    NSCAssert(active == (generation % 2 == 1), @"coherent snapshot");
                }
            });
        }
        for (NSInteger transition = 0; transition < 1000; transition++) {
            [store publishState:transition % 2 == 0 ? @"background" : @"active"];
        }
        dispatch_group_wait(readers, DISPATCH_TIME_FOREVER);
        puts("PASS iOS store: readiness, initial state, multi-context, dedup, teardown, "
             "recreation, weak ownership, coherent reads");
    }
    return 0;
}
