require "xcodeproj"

project = Xcodeproj::Project.new("LifecycleCheck.xcodeproj")
target = project.new_target(:framework, "LifecycleCheck", :ios, "12.0")
source = project.new_file("LifecycleCheck.m")
target.source_build_phase.add_file_reference(source)
target.build_configurations.each do |config|
    config.build_settings["PRODUCT_BUNDLE_IDENTIFIER"] = "dev.lynxlab.LifecycleCheck"
    config.build_settings["GENERATE_INFOPLIST_FILE"] = "YES"
    config.build_settings["CODE_SIGNING_ALLOWED"] = "NO"
end
project.save
