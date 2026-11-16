#import "LALAppStateStore.h"
#import <Lynx/LynxContext.h>
#import <UIKit/UIKit.h>

@interface LALAppStateStore ()
@property(nonatomic, strong) NSLock *lock;
@property(nonatomic, strong) NSDictionary *currentSnapshot;
@property(nonatomic, strong) NSHashTable<LynxContext *> *contexts;
@end

@implementation LALAppStateStore

+ (void)load {
    // Never synchronously wait for main from the bridge: main may be waiting for Lynx.
    dispatch_async(dispatch_get_main_queue(), ^{
        [[self sharedStore] startObserving];
    });
}

+ (instancetype)sharedStore {
    static LALAppStateStore *store;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        store = [[self alloc] init];
    });
    return store;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _lock = [[NSLock alloc] init];
        _contexts = [NSHashTable weakObjectsHashTable];
        _currentSnapshot = @{@"error" : @"NOT_INITIALIZED"};
    }
    return self;
}

- (void)dealloc {
    [NSNotificationCenter.defaultCenter removeObserver:self];
}

- (void)startObserving {
    NSNotificationCenter *center = NSNotificationCenter.defaultCenter;
    [center addObserver:self
               selector:@selector(didBecomeActive:)
                   name:UIApplicationDidBecomeActiveNotification
                 object:nil];
    [center addObserver:self
               selector:@selector(didEnterBackground:)
                   name:UIApplicationDidEnterBackgroundNotification
                 object:nil];
    [center addObserver:self
               selector:@selector(didFinishLaunching:)
                   name:UIApplicationDidFinishLaunchingNotification
                 object:nil];
    [self refreshApplicationState];
}

- (void)refreshApplicationState {
    UIApplicationState state = UIApplication.sharedApplication.applicationState;
    [self publishState:state == UIApplicationStateBackground ? @"background" : @"active"];
}

- (void)didFinishLaunching:(NSNotification *)notification {
    (void)notification;
    [self refreshApplicationState];
}

- (void)didBecomeActive:(NSNotification *)notification {
    (void)notification;
    [self publishState:@"active"];
}

- (void)didEnterBackground:(NSNotification *)notification {
    (void)notification;
    [self publishState:@"background"];
}

- (void)publishState:(NSString *)state {
    [self.lock lock];
    if ([self.currentSnapshot[@"state"] isEqual:state]) {
        [self.lock unlock];
        return;
    }
    NSNumber *previousGeneration = self.currentSnapshot[@"generation"];
    NSInteger generation = previousGeneration ? previousGeneration.integerValue + 1 : 0;
    NSDictionary *next = @{@"state" : state, @"generation" : @(generation)};
    self.currentSnapshot = next;
    NSArray<LynxContext *> *targets = self.contexts.allObjects;
    [self.lock unlock];
    for (LynxContext *context in targets) {
        if (!context.hasLynxViewDestroyed) {
            [context sendGlobalEvent:@"lynxappstatechange" withParams:@[ next ]];
        }
    }
}

- (NSDictionary *)snapshot {
    [self.lock lock];
    NSDictionary *snapshot = self.currentSnapshot;
    [self.lock unlock];
    return snapshot;
}

- (void)registerContext:(LynxContext *)context {
    [self.lock lock];
    [self.contexts addObject:context];
    [self.lock unlock];
}

- (void)unregisterContext:(LynxContext *)context {
    [self.lock lock];
    [self.contexts removeObject:context];
    [self.lock unlock];
}

@end
