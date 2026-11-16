#import <Foundation/Foundation.h>
typedef NS_ENUM(NSInteger, UIApplicationState) {
    UIApplicationStateActive,
    UIApplicationStateInactive,
    UIApplicationStateBackground,
};
FOUNDATION_EXPORT NSNotificationName const UIApplicationDidBecomeActiveNotification;
FOUNDATION_EXPORT NSNotificationName const UIApplicationDidEnterBackgroundNotification;
FOUNDATION_EXPORT NSNotificationName const UIApplicationDidFinishLaunchingNotification;
@interface UIApplication : NSObject
@property(nonatomic, assign) UIApplicationState applicationState;
+ (instancetype)sharedApplication;
@end
