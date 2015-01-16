#!/bin/ruby
require 'pp'

# Get the head gear
gear = `rhc app-show --gears scale | tail -n +3 | awk '{print $6}'`.split[0]

# Print the HAProxy process ID and configuration file
pid = `ssh #{gear} "ps aux" | grep "haproxy" | awk '{print $2}'`

# Print out the listen part of the haproxy config
config = `ssh #{gear} "cat haproxy/conf/haproxy.cfg" | tail -n +62`
puts "Process ID - #{pid}\n"
puts "Config:\n#{config}"
