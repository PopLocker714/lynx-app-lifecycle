#import <Foundation/Foundation.h>
@interface LynxContext : NSObject
@property(nonatomic, assign) BOOL hasLynxViewDestroyed;
@property(nonatomic, strong) NSMutableArray<NSDictionary *> *events;
- (void)sendGlobalEvent:(NSString *)name withParams:(NSArray *)params;
@end
