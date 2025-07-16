# Dummy Positions Data

This directory contains exported dummy positions for different maps.

## How to Use

1. **Export Positions**: Use `Ctrl+F` in-game to export dummy positions to clipboard
2. **Save Data**: Paste the exported JSON into the appropriate file
3. **Load Positions**: Use the DummyLoader utility to recreate dummy layouts

## File Structure

- `dummyPositions.json` - Default/current dummy layout
- `README.md` - This file

## Example Exported Data

```json
{
  "dummyPositions": [
    {"id": "placed_dummy_0", "position": {"x": 5.23, "y": 2.00, "z": 8.45}},
    {"id": "placed_dummy_1", "position": {"x": -3.12, "y": 4.67, "z": 2.89}}
  ],
  "totalDummies": 2,
  "exportedAt": "2025-01-16T05:35:00.000Z"
}
```

## Usage Instructions

1. **Place dummies** using the in-game placement system:
   - `F` - Place dummy at current position (supports midair!)
   - `Shift+F` - Remove last placed dummy  
   - `Ctrl+Shift+F` - Remove nearest dummy
   - `Alt+F` - Toggle placement preview mode

2. **Export your layout** with `Ctrl+F`

3. **Paste the exported JSON** into `dummyPositions.json`

4. **Load positions later** using the DummyLoader (future feature)

## Notes

- All positions support full 3D placement (midair, walls, ceilings)
- Positions are in world coordinates relative to map origin
- Use descriptive file names for different map layouts 