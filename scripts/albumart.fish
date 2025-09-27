#!/usr/bin/env fish

if test (count $argv) -ne 2
    echo "Usage: $0 <input_directory> <output_directory>"
    exit 1
end

set input_directory $argv[1]
set output_directory $argv[2]

mkdir -p $output_directory

set existing_files (ls $output_directory | string split -m 1 '.' | string join ' ')

for input_image in $input_directory/*
    set base_name (basename $input_image)
    set name_without_extension (string split -m 1 '.' $base_name)[1]

    if not echo $existing_files | grep -q $name_without_extension
        set output_image "$output_directory/$name_without_extension.png"

        magick $input_image -dither FloydSteinberg -scale 290x290 -monochrome $output_image
        
        echo "Converted $input_image to $output_image"
    else
        echo "$name_without_extension already exists in the output directory, skipping."
    end
end