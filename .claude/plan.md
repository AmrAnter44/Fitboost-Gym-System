# Implementation Plan: Automatic Barcode Scanner Device Selection

## Overview
Add a feature that allows users to configure a default barcode scanner device in settings. When barcode input is detected from this device, automatically open and focus the navbar search box for immediate scanning.

## Architecture Approach

### 1. Device Settings Context (NEW)
**File**: `contexts/DeviceSettingsContext.tsx`
- Create a new React Context following the same pattern as LanguageContext
- Store selected barcode scanner device ID in localStorage
- Provide `selectedScanner` state and `setSelectedScanner` function globally
- Key: `gym-device-settings` in localStorage

### 2. Settings Page Enhancement
**File**: `app/settings/page.tsx`
- Add new "Barcode Scanner Settings" section
- Display dropdown/select to choose from available devices
- Use html5-qrcode library's `Html5Qrcode.getCameras()` to detect available devices
- Show device names with friendly labels
- Save selection to DeviceSettingsContext
- Add loading state while detecting devices

### 3. Global Barcode Input Detector (NEW)
**File**: `components/BarcodeInputDetector.tsx`
- New component to be added to root layout
- Listen for keyboard wedge input (rapid typing followed by Enter)
- Detect barcode pattern:
  - Rapid consecutive keystrokes (within ~100ms intervals)
  - Terminated by Enter key
  - At least 4-8 characters long
- When detected, trigger navbar search modal to open
- Auto-populate the detected barcode value into search input
- Auto-submit the search

### 4. Navbar Search Integration
**File**: `components/Navbar.tsx`
- Expose `openQuickSearch` function via ref or context
- Add prop to accept pre-filled search value
- When opened with barcode value, auto-submit immediately
- Maintain existing Ctrl+K shortcut functionality

### 5. QRScanner Integration (OPTIONAL)
**File**: `components/QRScanner.tsx`
- Use `selectedScanner` from DeviceSettingsContext
- If device is selected, prefer it over automatic back camera selection
- Fallback to current behavior if selected device unavailable

### 6. Translation Updates
**Files**: `messages/ar.json`, `messages/en.json`
- Add translations for:
  - "Barcode Scanner Settings"
  - "Select Barcode Scanner Device"
  - "No devices found"
  - "Detecting devices..."
  - "Auto-scan enabled"

## Implementation Steps

### Step 1: Create DeviceSettingsContext
- Create `contexts/DeviceSettingsContext.tsx`
- Implement localStorage persistence
- Export Provider and custom hook
- Add to layout providers

### Step 2: Update Root Layout
- Import DeviceSettingsProvider
- Wrap app with provider (after LanguageProvider)
- Import and add BarcodeInputDetector component

### Step 3: Create BarcodeInputDetector Component
- Implement keyboard event listener
- Detect barcode input pattern (rapid typing + Enter)
- Trigger navbar search when barcode detected
- Handle edge cases (input fields should be ignored)

### Step 4: Enhance Navbar Search
- Add state management for external trigger
- Accept pre-filled value prop
- Implement auto-submit when opened via barcode
- Ensure backward compatibility with Ctrl+K

### Step 5: Update Settings Page
- Add barcode scanner section
- Implement device detection using Html5Qrcode.getCameras()
- Create device selector UI
- Connect to DeviceSettingsContext
- Add loading and error states

### Step 6: Update Translations
- Add all required Arabic translations to `messages/ar.json`
- Add all required English translations to `messages/en.json`

### Step 7: (Optional) Integrate with QRScanner
- Update QRScanner to use selected device from context
- Maintain fallback behavior

## Technical Considerations

### Barcode Detection Logic
- Keyboard wedge scanners typically send:
  1. Rapid keystrokes (< 50-100ms between keys)
  2. Complete string
  3. Enter key to terminate
- Need to distinguish from normal typing
- Threshold: If 6+ characters typed in < 500ms total, likely barcode

### Edge Cases
1. **User typing in input field**: Ignore barcode detection when focus is on input/textarea
2. **Modal open**: Don't trigger if search modal already open
3. **Device unavailable**: Handle gracefully if selected device disconnected
4. **Multiple scanners**: Allow switching between devices
5. **No devices found**: Show helpful message

### Performance
- Debounce device detection in settings (expensive operation)
- Minimize re-renders in BarcodeInputDetector
- Use event delegation for keyboard listener

## Files to Modify

1. ✏️ **NEW**: `contexts/DeviceSettingsContext.tsx`
2. ✏️ **NEW**: `components/BarcodeInputDetector.tsx`
3. ✏️ **MODIFY**: `app/layout.tsx` - Add providers and detector
4. ✏️ **MODIFY**: `components/Navbar.tsx` - Add external trigger support
5. ✏️ **MODIFY**: `app/settings/page.tsx` - Add scanner settings UI
6. ✏️ **MODIFY**: `messages/ar.json` - Add translations
7. ✏️ **MODIFY**: `messages/en.json` - Add translations
8. ✏️ **OPTIONAL**: `components/QRScanner.tsx` - Use selected device

## Testing Checklist

- [ ] Device selection saves to localStorage
- [ ] Selected device persists after page reload
- [ ] Barcode scan triggers navbar search
- [ ] Search auto-submits with barcode value
- [ ] Normal typing doesn't trigger barcode detection
- [ ] Ctrl+K shortcut still works
- [ ] Works with both Arabic and English languages
- [ ] Handles device disconnect gracefully
- [ ] No interference with existing search functionality
- [ ] Mobile compatibility (if applicable)

## Future Enhancements (Out of Scope)

- Support for multiple scanner types (USB, Bluetooth, etc.)
- Scanner configuration profiles
- Audio feedback customization for scanner input
- Scanner health monitoring/diagnostics
