# FastTyping Fingers - Touch Typing Website

A polished touch typing playground inspired by Monkeytype-class slickness, now reimagined with FastTyping Fingers branding, curated themes, and motion-rich feedback loops.

## Features

### Core Functionality
- **Home Page** - Welcome interface with test selection options
- **Typing Test Page** - Interactive typing practice with real-time feedback
- **Results Page** - Detailed statistics and performance analysis
- **About & Contact Pages** - Scroll-animated story highlights and outreach cards

### Test Customization
- **Time Modes**: 15s, 30s, 60s, 2min
- **Word Count**: 10, 25, 50, 100 words
- **Test Types**: Words, Time-based, Quote mode
- **Language Options**: 
  - English words only
  - English + Punctuation
  - English + Numbers  
  - Mixed (all combined)

### Visual Features
- **4 Curated Themes**: Coast, Harbor, Nebula, Ember
- **Real-time Feedback**: 
  - Green text for correct characters
  - Red highlighting for errors
  - Transparent upcoming text
  - Blinking cursor indicator
- **Live Statistics**: WPM, Accuracy, Timer display
- **Animated Polish**: Floating hero cards, marquee typing stream, scroll-reveal info cards, and soft page transitions

### Audio Features
- **Sound Effects**: Keystroke sounds and error notifications
- **Sound Toggle**: Easy on/off control
- **Audio Context**: Web Audio API for crisp sound generation

### Advanced Features
- **100 Practice Paragraphs**: Diverse content for extended practice
- **Backspace Support**: Full error correction capability
- **Progress Tracking**: Real-time WPM and accuracy calculation
- **Result Charts**: Speed and accuracy graphs over time
- **Test Recording**: Screen capture during typing (browser permitting)
- **Optimized Typing Engine**: Incremental DOM updates keep long tests responsive even with dense passages

### Technical Features
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Local Storage**: Saves user preferences and settings
- **Performance Optimized**: Smooth animations and interactions
- **Accessibility**: Keyboard navigation and screen reader friendly

## File Structure

```
fasttyping-fingers/
├── index.html              # Main HTML structure
├── css/
│   └── styles.css         # Complete styling with theme support
├── js/
│   ├── app.js            # Main application logic
│   ├── paragraphs.js     # 100 practice paragraphs
│   └── chart.js          # Custom charting library
└── README.md             # This file
```

## Getting Started

1. **Clone or Download** the project files
2. **Open** `index.html` in a modern web browser
3. **Start Typing** - Use the hero call-to-action or navigation to enter the test
4. **Customize** your experience with segmented controls, language toggles, and the floating theme palette

## Browser Support

- **Chrome** 60+ (recommended)
- **Firefox** 55+
- **Safari** 12+
- **Edge** 79+

*Note: Screen recording feature requires HTTPS and user permission*

## Usage Instructions

### Starting a Test
1. Navigate to the home page
2. Tap "Start typing now" or the Test link in the navbar
3. Adjust settings (time, words, mode, language)
4. Click in the translucent input shell and start typing

### During the Test
- Type the displayed text character by character
- Correct characters turn green
- Incorrect characters are highlighted in red
- Use backspace to correct mistakes
- Watch your live WPM and accuracy stats

### Customization
- **Themes**: Click the 🎨 button to open the palette (Coast, Harbor, Nebula, Ember)
- **Sound**: Click the 🔊 button to toggle audio feedback
- **Test Settings**: Use dropdowns to adjust time, word count, and language options

### Viewing Results
- Complete a test to see detailed statistics
- View speed and accuracy charts
- Share your results with others
- Take another test or return home

## Performance Tips

1. **Focus on Accuracy** before speed
2. **Use All Fingers** for proper touch typing
3. **Maintain Rhythm** rather than rushing
4. **Practice Regularly** for consistent improvement
5. **Try Different Modes** to challenge various skills

## Technical Notes

### Local Storage
The application saves:
- Theme preferences
- Sound settings
- Test configuration preferences

### Screen Recording
- Requires modern browser with MediaRecorder API
- Needs user permission for screen capture
- Falls back gracefully if not available

### Audio System
- Uses Web Audio API for low-latency sound
- Generates tones programmatically
- No external audio files required

## Development

### Adding New Paragraphs
Edit `js/paragraphs.js` to add more practice content to the `paragraphs` array.

### Customizing Themes
Modify CSS custom properties in `css/styles.css` under each `.theme-*` class.

### Extending Features
The modular JavaScript structure in `js/app.js` makes it easy to add new functionality.

## Credits

Built with modern web technologies:
- **HTML5** for structure
- **CSS3** for styling and animations  
- **Vanilla JavaScript** for functionality
- **Web Audio API** for sound effects
- **Canvas API** for charting

## License

This project is open source and available under the MIT License.

---

**FastTyping Fingers** - Master the art of touch typing with a glassmorphic, theme-rich practice platform!