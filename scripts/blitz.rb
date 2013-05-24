#!/usr/bin/env ruby

require 'rubygems'
require 'blitz'
require 'pp'

url = "--timeout 5000 http://scaledemo-cloudydemo.rhcloud.com/rest/add"

# Run a rush - should scale up to 2 gears
rush = Blitz::Curl.parse("--pattern 1-150:30,150-150:240 #{url}")
rush.execute do |partial|
    pp [ partial.region, partial.timeline.last.hits ]
end

# Push us to 3...
rush = Blitz::Curl.parse("--pattern 150-300:30,300-300:240 #{url}")
rush.execute do |partial|
    pp [ partial.region, partial.timeline.last.hits ]
end

# Now to 4...
rush = Blitz::Curl.parse("--pattern 300-450:30,450-450:240 #{url}")
rush.execute do |partial|
    pp [ partial.region, partial.timeline.last.hits ]
end

puts "Success"
