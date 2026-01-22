---
name: image-processor
description: Batch convert, compress, resize and rename images using macOS tools.
---

# Image Processor Skill

A batch image processing skill designed for photographers and designers. This skill provides efficient bulk operations for format conversion, compression, resizing, renaming, and EXIF extraction.

## Core Capabilities

### 1. Batch Format Conversion
Convert images between formats: JPG, PNG, WebP, HEIC.

### 2. Batch Compression
Compress images with configurable quality percentage or target file size.

### 3. Batch Renaming
Rename files using templates such as `{date}_{location}_{sequence}`.

### 4. Batch Resizing
Resize images by dimensions, percentage, or longest edge.

### 5. EXIF Information
Extract and display EXIF metadata from images.

---

## Safety Principles

**CRITICAL: Always follow these rules before any destructive operation.**

1. **Preview First**: Before processing, always list all files that will be affected and show the user what changes will be made.

2. **Preserve Originals**: By default, output processed images to a new folder (e.g., `./processed/` or `./output/`). Never overwrite original files unless the user explicitly requests it.

3. **Confirm Before Execution**: After showing the preview, ask the user to confirm before proceeding with the actual operation.

4. **Dry Run Option**: When requested, perform a dry run that shows what would happen without making changes.

---

## Tool Detection

Before processing, detect available tools in this priority order:

```bash
# Check for available image processing tools
command -v sips >/dev/null 2>&1 && echo "sips: available (macOS built-in)"
command -v magick >/dev/null 2>&1 && echo "ImageMagick: available"
command -v convert >/dev/null 2>&1 && echo "ImageMagick (legacy): available"
command -v ffmpeg >/dev/null 2>&1 && echo "ffmpeg: available"
```

**Tool Priority:**
1. `sips` - macOS built-in, always available, best for basic operations
2. `ImageMagick` (`magick` or `convert`) - most powerful, supports all formats
3. `ffmpeg` - good for format conversion, especially video thumbnails

**Important Limitations:**
- `sips` does NOT support writing WebP format. Use ImageMagick or ffmpeg for WebP output.
- `sips` supported write formats: JPEG, PNG, HEIC, TIFF, GIF, BMP

---

## Implementation Reference

### Format Conversion

**Using sips (macOS):**
```bash
# Convert to JPEG
sips -s format jpeg input.png --out output.jpg

# Convert to PNG
sips -s format png input.jpg --out output.png

# Convert HEIC to JPEG
sips -s format jpeg input.HEIC --out output.jpg
```

**Using ImageMagick:**
```bash
# Convert format
magick input.png output.jpg

# Convert HEIC to JPEG
magick input.HEIC output.jpg

# Convert to WebP
magick input.jpg output.webp
```

**Using ffmpeg:**
```bash
# Convert to JPEG
ffmpeg -i input.png -q:v 2 output.jpg

# Convert to WebP (correct syntax)
ffmpeg -i input.jpg -c:v libwebp -q:v 80 output.webp

# Convert to WebP with lossless option
ffmpeg -i input.jpg -c:v libwebp -lossless 0 -q:v 80 output.webp
```

**Note:** The `-quality` parameter is NOT valid for ffmpeg. Use `-q:v` or `-qscale:v` instead.

### Compression

**Using sips:**
```bash
# Compress JPEG (quality 0-100, lower = more compression)
sips -s formatOptions 80 input.jpg --out output.jpg
```

**Warning:** Re-compressing an already compressed image may actually INCREASE file size. This happens when the original was compressed with different settings. Always check output size and skip if larger than original.

**Using ImageMagick:**
```bash
# Compress JPEG with quality setting
magick input.jpg -quality 80 output.jpg

# Compress PNG
magick input.png -quality 80 output.png

# Compress to target file size (approximate)
magick input.jpg -define jpeg:extent=500KB output.jpg
```

### Resizing

**Using sips:**
```bash
# Resize to specific dimensions
sips -z 1080 1920 input.jpg --out output.jpg

# Resize by longest edge (maintain aspect ratio)
sips --resampleHeightWidthMax 1920 input.jpg --out output.jpg

# Resize by width only
sips --resampleWidth 800 input.jpg --out output.jpg
```

**Using ImageMagick:**
```bash
# Resize to exact dimensions
magick input.jpg -resize 1920x1080! output.jpg

# Resize maintaining aspect ratio (fit within)
magick input.jpg -resize 1920x1080 output.jpg

# Resize by percentage
magick input.jpg -resize 50% output.jpg

# Resize by longest edge
magick input.jpg -resize 1920x1920 output.jpg
```

### EXIF Extraction

**Using sips:**
```bash
# Get all properties
sips -g all image.jpg
```

**Using ImageMagick:**
```bash
# Get EXIF data
magick identify -verbose image.jpg | grep -A 100 "Properties:"
```

**Using exiftool (if available):**
```bash
exiftool image.jpg
```

**Using mdls (macOS):**
```bash
mdls image.jpg
```

### Batch Renaming

**Template Variables:**
- `{date}` - Date from EXIF or file modification time (YYYYMMDD)
- `{time}` - Time from EXIF or file modification time (HHMMSS)
- `{datetime}` - Combined date and time
- `{location}` - GPS location if available, or user-provided
- `{seq}` or `{sequence}` - Sequential number (001, 002, ...)
- `{original}` - Original filename without extension
- `{ext}` - Original file extension

**WeChat Export Filename Parsing:**
WeChat exports images as `mmexport{timestamp}.jpg` where timestamp is Unix milliseconds.
```bash
# Extract date from WeChat filename
filename="mmexport1705123456789.jpg"
timestamp=$(echo "$filename" | grep -o '[0-9]\{13\}')
date=$(date -r $((timestamp/1000)) "+%Y-%m-%d")
echo "$date"  # Output: 2024-01-13
```

**Example Script:**
```bash
#!/bin/bash
# Rename files with date prefix
counter=1
for file in *.jpg *.jpeg *.png *.heic *.HEIC 2>/dev/null; do
    [ -f "$file" ] || continue

    # Get date from EXIF or file modification time
    date=$(mdls -name kMDItemContentCreationDate "$file" 2>/dev/null | awk '{print $3}' | tr -d '-')
    if [ -z "$date" ] || [ "$date" = "(null)" ]; then
        date=$(stat -f "%Sm" -t "%Y%m%d" "$file")
    fi

    # Format: DATE_LOCATION_SEQ.ext
    ext="${file##*.}"
    newname=$(printf "%s_%s_%03d.%s" "$date" "location" "$counter" "$ext")

    echo "Rename: $file -> $newname"
    ((counter++))
done
```

---

## Workflow

When the user requests image processing:

1. **Gather Requirements**
   - Ask for the source directory or files
   - Ask for the desired operation(s)
   - Ask for specific parameters (quality, dimensions, format, naming template)

2. **Detect Tools**
   - Check which image processing tools are available
   - Select the best tool for the requested operation

3. **Preview Changes**
   - List all files that will be processed
   - Show the expected output (new filenames, destination folder)
   - Display estimated file sizes if compressing

4. **Confirm with User**
   - Ask for explicit confirmation before proceeding
   - Offer dry-run option if user is uncertain

5. **Execute**
   - Create output directory if needed
   - Process files one by one, showing progress
   - Report any errors encountered

6. **Report Results**
   - Summarize successful operations
   - List any files that failed and why
   - Show before/after file sizes if relevant

---

## Example Interactions

**User:** "Convert all HEIC files in ~/Photos to JPEG"

**Response:**
1. Scan ~/Photos for HEIC files
2. List found files (e.g., "Found 47 HEIC files")
3. Propose output location: ~/Photos/converted/
4. Ask for confirmation
5. Execute conversion
6. Report results

**User:** "Compress images in ./uploads to under 500KB each"

**Response:**
1. Scan ./uploads for image files
2. Show current file sizes
3. Propose output location: ./uploads/compressed/
4. Ask for confirmation
5. Execute compression with progressive quality reduction
6. Report results with before/after sizes

**User:** "Rename photos with date and sequence number"

**Response:**
1. Ask for source directory
2. Ask for naming template preference
3. Preview the rename mapping
4. Ask for confirmation
5. Execute renaming
6. Report results

---

## Error Handling

- If a tool is not available, suggest alternatives or installation commands
- If a file cannot be processed, log the error and continue with remaining files
- If output directory cannot be created, report the error and stop
- Always provide clear error messages with suggested fixes
