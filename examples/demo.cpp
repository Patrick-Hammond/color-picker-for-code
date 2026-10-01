// Try the extension: click a colour swatch (or put the cursor on a value and run
// "Color Picker For Code: Pick Color at Cursor") and drag around in the picker.

// 6 digits: 0xRRGGBB
const uint32_t kRed    = 0xFF0000;
const uint32_t kOrange = 0xff8800;      // lower-case stays lower-case
const uint32_t kSky    = 0X87CEEB;

// 8 digits: 0xRRGGBBAA (set colorPickerForCode.alphaPosition to "start" for 0xAARRGGBB)
const uint32_t kGlass  = 0x3399FF80;
const uint32_t kClear  = 0x00000000;

// Integer suffixes and member access are fine
const uint32_t kBlue   = 0x0000FFu;
auto hex = (0x00FF00).toString(16);

// Not colours (wrong digit count / glued to something else): no swatch
int a = 0xFFF;
int b = 0xFFFFFFF;
int c = 0xFF'FF'FF;
int d = 0xFFFFFFFFF;
int e = x0xFF0000;
