require 'xcodeproj'

# This adapter supports the generated Sparkling projects without source filters.
# Reject definitions, including conditional/inherited ones, rather than emulate
# Xcode's platform-specific precedence and accidentally accept an excluded file.
def assert_unfiltered_sources!(project, target)
    configuration_files = []
    [project, target].each do |owner|
        owner.build_configurations.each do |configuration|
            next unless %w[Debug Release].include?(configuration.name)

            settings = [configuration.build_settings, ENV.to_h]
            reference = configuration.base_configuration_reference
            if reference
                raise 'Missing source configuration' unless reference.real_path.file?
                config = Xcodeproj::Config.new(reference.real_path)
                # Generated configs in this profile are self-contained. Do not
                # resolve arbitrary includes differently from Xcode.
                raise 'Unsupported source configuration includes' unless config.includes.empty?
                settings << config.to_hash
                configuration_files << File.realpath(reference.real_path)
            end
            settings.each do |values|
                filter = values.keys.find do |key|
                    key.match?(/\A(?:EXCLUDED|INCLUDED)_SOURCE_FILE_NAMES(?:\[|\z)/)
                end
                raise "Unsupported source filter #{filter} in #{target.name}/#{configuration.name}" if filter
            end
        end
    end
    target.source_build_phase.files.each do |file|
        attributes = file.to_hash
        unless attributes['platformFilter'].to_s.empty? && Array(attributes['platformFilters']).empty?
            raise "Unsupported source platform filter in #{target.name}"
        end
    end
    configuration_files.uniq
end
