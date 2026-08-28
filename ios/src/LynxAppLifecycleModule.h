#import <Foundation/Foundation.h>
#import <Lynx/LynxContext.h>
#import <Lynx/LynxContextModule.h>
#import <Lynx/LynxModule.h>

NS_ASSUME_NONNULL_BEGIN

// Макрос LynxNativeModule появился только в Lynx 3.9.0. На 3.6.0 его нет, и тогда
// `@LynxNativeModule("...")` это `@` плюс неизвестный идентификатор, то есть ошибка
// `unexpected '@' in program`, а следом `cannot use 'super' because it is a root class`.
// Объявляем сами ровно тем же, чем это делает Lynx: раскрывается в
// `@class LynxNativeModuleMarker;` и нужен только для регулярки гема autolink.
#ifndef LynxNativeModule
#define LynxNativeModule(module_name) class LynxNativeModuleMarker;
#endif

/**
 * iOS-половина `@lynx-lab/app-lifecycle`.
 *
 * Conform к LynxContextModule не косметика: CommonModuleCreator проверяет именно
 * этот протокол и тогда сам зовёт `initWithLynxContext:`, подставляя LynxContext.
 * Autolink регистрирует модуль БЕЗ param, поэтому `initWithParam:` не вызовется
 * никогда, и без этого протокола контекста, а значит и sendGlobalEvent, не будет.
 */
@LynxNativeModule("LynxAppLifecycleModule")
@interface LynxAppLifecycleModule : NSObject <LynxContextModule>
@end

NS_ASSUME_NONNULL_END
