require 'tmpdir'
require_relative 'source-filters'

def rejected(label)
    yield
rescue RuntimeError => error
    raise unless error.message.start_with?('Unsupported source')
else
    raise "Accepted #{label}"
end

Dir.mktmpdir('lynx-source-filters-') do |directory|
    project = Xcodeproj::Project.new(File.join(directory, 'Fixture.xcodeproj'))
    target = project.new_target(:framework, 'Fixture', :ios, '15.6')
    source = target.source_build_phase.add_file_reference(project.new_file('Module.m'))
    assert_unfiltered_sources!(project, target)

    [project, target].each do |owner|
        owner.build_configurations.each do |configuration|
            %w[EXCLUDED_SOURCE_FILE_NAMES INCLUDED_SOURCE_FILE_NAMES].each do |key|
                configuration.build_settings[key] = 'Module.m'
                rejected("#{owner.class}/#{configuration.name}/#{key}") do
                    assert_unfiltered_sources!(project, target)
                end
                configuration.build_settings.delete(key)
            end
        end
    end

    File.write(File.join(directory, 'Filters.xcconfig'), "EXCLUDED_SOURCE_FILE_NAMES[sdk=iphoneos*] = Module.m\n")
    File.write(File.join(directory, 'Base.xcconfig'), "#include \"Filters.xcconfig\"\n")
    configuration = target.build_configurations.first
    configuration.base_configuration_reference = project.new_file(File.join(directory, 'Filters.xcconfig'))
    rejected('conditional xcconfig filter') { assert_unfiltered_sources!(project, target) }
    configuration.base_configuration_reference = project.new_file(File.join(directory, 'Base.xcconfig'))
    rejected('unsupported xcconfig include') { assert_unfiltered_sources!(project, target) }
    configuration.base_configuration_reference = nil

    source.platform_filter = 'macos'
    rejected('platformFilter') { assert_unfiltered_sources!(project, target) }
    source.platform_filter = nil
    source.platform_filters = ['macos']
    rejected('platformFilters') { assert_unfiltered_sources!(project, target) }
    source.platform_filters = []
    assert_unfiltered_sources!(project, target)
end
puts 'Source-filter rejection checks passed'
