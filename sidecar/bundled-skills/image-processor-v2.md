---
name: image-processor-v2
description: Batch convert, compress, resize and rename images with configurable options.
category: file-management
version: 2.0.0
parameters:
  - name: input_path
    type: string
    label: "Input Path"
    description: "File or folder containing images to process"
    required: true
    placeholder: "/path/to/images"
  - name: output_format
    type: select
    label: "Output Format"
    options:
      - { value: "jpg", label: "JPEG" }
      - { value: "png", label: "PNG" }
      - { value: "webp", label: "WebP (Recommended)" }
      - { value: "heic", label: "HEIC" }
    default: "webp"
  - name: max_width
    type: number
    label: "Max Width (px)"
    description: "Images wider than this will be resized"
    min: 100
    max: 8000
    default: 1920
  - name: quality
    type: number
    label: "Quality %"
    description: "Compression quality (1-100)"
    min: 1
    max: 100
    default: 85
  - name: preserve_originals
    type: boolean
    label: "Preserve Original Files"
    description: "Keep original files in a backup folder"
    default: true
---

# Image Processor

Process images at **{{input_path}}** with the following settings:

- **Output format:** {{output_format}}
- **Maximum width:** {{max_width}}px
- **Quality:** {{quality}}%
- **Preserve originals:** {{preserve_originals}}

## Instructions

1. First, scan the input path and list all image files found
2. Show a preview of what will be processed
3. Ask for confirmation before proceeding
4. Process each image according to the settings above
5. Report results with before/after file sizes

## Safety Rules

- Always preserve original files unless explicitly told otherwise
- Create output in a subfolder (e.g., `./processed/`)
- Never overwrite without confirmation
