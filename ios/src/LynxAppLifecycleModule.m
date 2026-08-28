#import "LynxAppLifecycleModule.h"
#import <UIKit/UIKit.h>

static NSString *const kEventName = @"lynxappstatechange";
static NSString *const kStateActive = @"active";
static NSString *const kStateBackground = @"background";

/// Процесс-глобальные: состояние приложения одно на процесс, а экземпляров
/// модуля может быть несколько, по одному на LynxView.
static NSString *gState = nil;
static NSInteger gGeneration = 0;

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
    // Модуль создаётся лениво при первом обращении из JS, то есть приложение
    // уже на переднем плане. Начальное состояние берём отсюда, а не угадываем.
    if (gState == nil) {
      gState = kStateActive;
    }
    NSNotificationCenter *nc = [NSNotificationCenter defaultCenter];
    [nc addObserver:self
           selector:@selector(spk_didBecomeActive)
               name:UIApplicationDidBecomeActiveNotification
             object:nil];
    [nc addObserver:self
           selector:@selector(spk_didEnterBackground)
               name:UIApplicationDidEnterBackgroundNotification
             object:nil];
  }
  return self;
}

- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)spk_emit:(NSString *)state {
  if ([state isEqualToString:gState]) {
    return;
  }
  gState = state;
  gGeneration += 1;
  // sendGlobalEvent молча дропает, если GlobalEventEmitter ещё нет.
  // Это допустимо: начальное состояние JS берёт синхронным getState().
  [self.lynxContext sendGlobalEvent:kEventName
                         withParams:@[ @{@"state" : state, @"generation" : @(gGeneration)} ]];
}

- (void)spk_didBecomeActive {
  [self spk_emit:kStateActive];
}

- (void)spk_didEnterBackground {
  [self spk_emit:kStateBackground];
}

/// Синхронно, возврат NSDictionary через _C_ID.
/// Имена методов намеренно без ARC selector family (new/copy/init/alloc/mutableCopy):
/// PerformMethodInvocation делает getReturnValue плюс __bridge без передачи владения.
- (NSDictionary *)getState {
  return @{@"state" : (gState ?: kStateActive), @"generation" : @(gGeneration)};
}

- (NSString *)getEventName {
  return kEventName;
}

@end
