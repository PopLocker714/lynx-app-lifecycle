require 'json'
require 'yaml'
require 'xcodeproj'
require_relative 'source-filters'

# Deliberately limited to the checked Sparkling 2.1 / Lynx 3.9 fixture layout.
pod = ARGV.fetch(0)
raise 'Unsupported pod' unless %w[LynxAppLifecycle].include?(pod)

def target(project, name)
    project.targets.find { |candidate| candidate.name == name } or raise "Missing target #{name}"
end

def linked?(project, owner, dependency_project, dependency_target)
    owner.dependencies.any? do |dependency|
        proxy = dependency.target_proxy
        next false unless proxy
        reference = project.objects_by_uuid[proxy.container_portal]
        reference && File.realpath(reference.real_path) == File.realpath(dependency_project.path) &&
            proxy.remote_global_id_string == dependency_target.uuid
    end
end

lock = YAML.load_file('Podfile.lock')
raise 'Pods manifest differs from lock' unless lock == YAML.load_file('Pods/Manifest.lock')
versions = lock.fetch('PODS').flat_map { |entry| entry.is_a?(Hash) ? entry.keys : entry }
%w[Lynx Sparkling].zip(%w[3.9.0 2.1.0-rc.36]).each do |name, version|
    raise "Unsupported #{name} version" unless versions.include?("#{name} (#{version})")
end
library_project = Xcodeproj::Project.open("Pods/#{pod}.xcodeproj")
library = target(library_project, pod)
registry_project = Xcodeproj::Project.open('Pods/LynxLibraryRegistry.xcodeproj')
registry = target(registry_project, 'LynxLibraryRegistry')
source_configurations = assert_unfiltered_sources!(library_project, library)
source_configurations.concat(assert_unfiltered_sources!(registry_project, registry))
pods = Xcodeproj::Project.open('Pods/Pods.xcodeproj')
app = Xcodeproj::Project.open('SparklingGo.xcodeproj')
workspace = File.read('SparklingGo.xcworkspace/contents.xcworkspacedata')
%w[SparklingGo.xcodeproj Pods/Pods.xcodeproj].each do |path|
    raise "Workspace does not include #{path}" unless workspace.include?("group:#{path}")
end
bindings = %w[SparklingGo SparklingGoInHouse].to_h do |name|
    aggregate = target(pods, "Pods-#{name}")
    raise "Unlinked #{pod}" unless linked?(pods, aggregate, library_project, library)
    raise 'Unlinked registry' unless linked?(pods, aggregate, registry_project, registry)
    app_target = target(app, name)
    frameworks = app_target.frameworks_build_phase.files_references.map(&:path)
    raise 'Missing Pods framework' unless frameworks.include?("Pods_#{name}.framework")
    scheme = Xcodeproj::XCScheme.new("SparklingGo.xcodeproj/xcshareddata/xcschemes/#{name}.xcscheme")
    unless scheme.build_action.entries.any? { |entry| entry.buildable_references.any? { |ref| ref.target_uuid == app_target.uuid } }
        raise "Scheme does not build #{name}"
    end
    configurations = %w[Debug Release].to_h do |configuration|
        config = app_target.build_configurations.find { |item| item.name == configuration }
        expected = File.realpath("Pods/Target Support Files/Pods-#{name}/Pods-#{name}.#{configuration.downcase}.xcconfig")
        raise 'Unexpected base configuration' unless File.realpath(config.base_configuration_reference.real_path) == expected
        [app_target, app].each do |owner|
            flags = owner.build_configurations.find { |item| item.name == configuration }.build_settings['OTHER_LDFLAGS']
            raise 'Unsupported linker override' unless [nil, '$(inherited)', ['$(inherited)']].include?(flags)
        end
        flags = File.readlines(expected).find { |line| line.start_with?('OTHER_LDFLAGS = ') } || ''
        [pod, 'LynxLibraryRegistry'].each do |framework|
            raise "Unlinked framework #{framework}" unless flags.include?("-framework \"#{framework}\"")
        end
        [configuration, expected]
    end
    [name, configurations]
end
puts JSON.generate({
    podPath: File.realpath(lock.fetch('EXTERNAL SOURCES').fetch(pod).fetch(:path)),
    project: File.realpath(library_project.path),
    sources: library.source_build_phase.files_references.map { |ref| File.realpath(ref.real_path) },
    headers: library.headers_build_phase.files_references.map { |ref| File.realpath(ref.real_path) },
    registry: registry.source_build_phase.files_references.map { |ref| File.realpath(ref.real_path) },
    sourceConfigurations: source_configurations.uniq,
    linkedTargets: bindings
})
