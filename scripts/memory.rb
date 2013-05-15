#!/bin/ruby
require 'pp'

# Get a list of the gears SSH entries
`rhc app-show --gears scale | tail -n +3 | awk '{print $6}'`.split.each_with_index do |gear, i|
  # Get the resident memory for the java process
  gear_mem = `ssh #{gear} "ps aux" | grep java | awk '{print $6}'`
  print "Gear #{i+1} Memory - #{gear_mem}"
end
