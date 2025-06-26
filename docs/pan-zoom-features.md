# Pan & Zoom Features

## Overview

Our SVG posters now support intuitive pan and zoom interactions across all devices. Users can explore vector graphics with natural touch and mouse gestures, with their preferred view states automatically saved and restored.

## Key Features

### 🎯 **True SVG Zoom**

- Manipulates the actual SVG viewBox for crisp rendering at all zoom levels
- No pixel scaling artifacts or quality loss
- Maintains vector sharpness from 50% to 300% zoom

### 📱 **Cross-Device Support**

- **Desktop**: Mouse drag + wheel zoom
- **Mobile**: Touch drag + pinch zoom
- **Universal**: Pointer events for consistent behavior
- **Tablet**: Full touch gesture support

### 💾 **Persistent State**

- ViewBox transforms automatically saved to localStorage
- Each poster maintains its own zoom/pan state
- Seamless restoration when returning to previously viewed posters

## Interaction Methods

### Desktop Controls

| Action       | Gesture          | Effect                          |
| ------------ | ---------------- | ------------------------------- |
| **Pan**      | Click + drag     | Move viewport around the poster |
| **Zoom In**  | Mouse wheel up   | Increase zoom level             |
| **Zoom Out** | Mouse wheel down | Decrease zoom level             |
| **Reset**    | Double-click     | Return to original view         |

### Mobile Controls

| Action       | Gesture                   | Effect                          |
| ------------ | ------------------------- | ------------------------------- |
| **Pan**      | One finger drag           | Move viewport around the poster |
| **Zoom In**  | Two finger pinch apart    | Increase zoom level             |
| **Zoom Out** | Two finger pinch together | Decrease zoom level             |
| **Reset**    | Double-tap                | Return to original view         |

## Technical Implementation

### Storage Strategy

```javascript
// Each poster gets unique storage key
const storage_key = `viewbox-${itemid}`

// Transform state structure
{
  x: 0,        // Pan offset X
  y: 0,        // Pan offset Y
  scale: 1     // Zoom level (0.5 - 3.0)
}
```

### ViewBox Calculation

```javascript
// Dynamic viewBox with transforms
const dynamic_viewbox = computed(() => {
  const { x, y, width, height } = original_viewbox.value
  const { x: dx, y: dy, scale } = viewbox_transform.value

  const new_width = width / scale
  const new_height = height / scale
  const new_x = x + dx / scale
  const new_y = y + dy / scale

  return `${new_x} ${new_y} ${new_width} ${new_height}`
})
```

### Event Handling

- **Pointer Events**: Universal mouse/touch support
- **Touch Events**: Native mobile gesture recognition
- **Wheel Events**: Desktop zoom functionality
- **Prevent Default**: Blocks browser gestures for custom behavior

## User Experience Benefits

### 🎨 **Enhanced Exploration**

- Zoom in to examine fine details in vector paths
- Pan around large posters to see full composition
- Discover hidden elements and textures

### 📱 **Mobile-First Design**

- Intuitive touch gestures feel natural
- Responsive to different screen sizes
- Optimized for one-handed use

### 🔄 **Seamless Workflow**

- No need to re-zoom when returning to posters
- Maintains context across browsing sessions
- Quick reset option for fresh perspective

## Browser Compatibility

| Feature        | Chrome | Firefox | Safari | Edge |
| -------------- | ------ | ------- | ------ | ---- |
| Pan            | ✅     | ✅      | ✅     | ✅   |
| Zoom           | ✅     | ✅      | ✅     | ✅   |
| Touch Gestures | ✅     | ✅      | ✅     | ✅   |
| Storage        | ✅     | ✅      | ✅     | ✅   |

## Performance Considerations

### Optimizations

- **Debounced Updates**: Smooth 60fps interactions
- **Efficient Calculations**: Minimal re-renders
- **Memory Management**: Automatic cleanup on unmount
- **Storage Limits**: Bounded transform values

### Limits

- **Zoom Range**: 0.5x to 3.0x (50% to 300%)
- **Storage Size**: ~100 bytes per poster
- **Gesture Recognition**: 2-finger minimum for pinch

## Future Enhancements

### Planned Features

- **Zoom to Point**: Click to zoom into specific areas
- **Gesture History**: Undo/redo zoom/pan actions
- **Shared Views**: Link to specific zoom levels
- **Auto-fit**: Smart initial zoom based on screen size

### MCP Server Integration

- **Remote State**: Sync viewBox across devices
- **Collaborative Viewing**: Shared zoom sessions
- **Analytics**: Track popular zoom levels and areas
- **API Endpoints**: Programmatic zoom control

## Usage Examples

### Basic Interaction

```javascript
// User drags poster - viewBox updates automatically
// User pinches to zoom - scale updates in real-time
// User double-taps - viewBox resets to original
```

### Programmatic Control

```javascript
// Reset zoom for specific poster
const reset_poster_view = itemid => {
  const storage_key = `viewbox-${itemid}`
  localStorage.setItem(
    storage_key,
    JSON.stringify({
      x: 0,
      y: 0,
      scale: 1
    })
  )
}
```

## Accessibility

### Keyboard Support

- **Arrow Keys**: Pan in 4 directions
- **+/- Keys**: Zoom in/out
- **Home Key**: Reset to original view
- **Tab Navigation**: Focus management

### Screen Reader Support

- **ARIA Labels**: Announce zoom levels
- **Live Regions**: Update on view changes
- **Focus Indicators**: Clear interaction feedback

## Troubleshooting

### Common Issues

1. **Zoom not working**: Check touch-action CSS property
2. **Storage not saving**: Verify localStorage permissions
3. **Gestures conflicting**: Ensure preventDefault() is called
4. **Performance issues**: Monitor transform calculation frequency

### Debug Mode

```javascript
// Enable debug logging
const DEBUG_ZOOM = true

if (DEBUG_ZOOM) {
  console.log('ViewBox transform:', viewbox_transform.value)
  console.log('Storage key:', storage_key.value)
}
```

---

_This documentation covers the complete pan and zoom implementation for our SVG poster viewer. The feature enhances user engagement while maintaining performance and accessibility standards._
