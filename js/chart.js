// Simple Chart.js alternative for lightweight charting
// This provides basic charting functionality without external dependencies

class SimpleChart {
    constructor(canvas, data, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.data = data;
        this.options = {
            type: 'line',
            colors: {
                line: '#fefae0',
                fill: 'rgba(96, 108, 56, 0.25)',
                grid: 'rgba(254, 250, 224, 0.2)',
                text: 'rgba(254, 250, 224, 0.7)'
            },
            padding: 40,
            pointRadius: 4,
            lineWidth: 2,
            gridLines: true,
            labels: true,
            ...options
        };
        this.applyThemeColors();
        this.render();
    }

    render() {
        this.applyThemeColors();
        this.clear();
        this.drawGrid();
        this.drawData();
        this.drawLabels();
    }

    applyThemeColors() {
        if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) return;
        const styles = getComputedStyle(document.body);
        const colorVars = {
            line: '--chart-line-color',
            fill: '--chart-fill-color',
            grid: '--chart-grid-color',
            text: '--chart-text-color'
        };

        Object.entries(colorVars).forEach(([key, varName]) => {
            const value = styles.getPropertyValue(varName)?.trim();
            if (value) {
                this.options.colors[key] = value;
            }
        });
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGrid() {
        if (!this.options.gridLines) return;

        const { width, height } = this.canvas;
        const { padding } = this.options;
        const chartWidth = width - 2 * padding;
        const chartHeight = height - 2 * padding;

        this.ctx.strokeStyle = this.options.colors.grid;
        this.ctx.lineWidth = 1;

        // Vertical grid lines
        const verticalLines = 5;
        for (let i = 0; i <= verticalLines; i++) {
            const x = padding + (i / verticalLines) * chartWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(x, padding);
            this.ctx.lineTo(x, height - padding);
            this.ctx.stroke();
        }

        // Horizontal grid lines
        const horizontalLines = 4;
        for (let i = 0; i <= horizontalLines; i++) {
            const y = padding + (i / horizontalLines) * chartHeight;
            this.ctx.beginPath();
            this.ctx.moveTo(padding, y);
            this.ctx.lineTo(width - padding, y);
            this.ctx.stroke();
        }
    }

    drawData() {
        if (!this.data || this.data.length === 0) return;

        const { width, height } = this.canvas;
        const { padding, pointRadius, lineWidth } = this.options;
        const chartWidth = width - 2 * padding;
        const chartHeight = height - 2 * padding;

        const maxValue = Math.max(...this.data.map(d => d.value));
        const minValue = Math.min(...this.data.map(d => d.value));
        const valueRange = maxValue - minValue || 1;

        // Draw line
        this.ctx.strokeStyle = this.options.colors.line;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();

        this.data.forEach((point, index) => {
            const x = padding + (index / (this.data.length - 1)) * chartWidth;
            const y = height - padding - ((point.value - minValue) / valueRange) * chartHeight;

            if (index === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        });

        this.ctx.stroke();

        // Draw fill area if specified
        if (this.options.fill) {
            this.ctx.fillStyle = this.options.colors.fill;
            this.ctx.beginPath();
            
            // Start from bottom left
            const firstX = padding;
            const firstY = height - padding - ((this.data[0].value - minValue) / valueRange) * chartHeight;
            this.ctx.moveTo(firstX, height - padding);
            this.ctx.lineTo(firstX, firstY);

            // Draw the line
            this.data.forEach((point, index) => {
                const x = padding + (index / (this.data.length - 1)) * chartWidth;
                const y = height - padding - ((point.value - minValue) / valueRange) * chartHeight;
                this.ctx.lineTo(x, y);
            });

            // Close the path at bottom right
            const lastX = padding + chartWidth;
            this.ctx.lineTo(lastX, height - padding);
            this.ctx.closePath();
            this.ctx.fill();
        }

        // Draw points
        this.ctx.fillStyle = this.options.colors.line;
        this.data.forEach((point, index) => {
            const x = padding + (index / (this.data.length - 1)) * chartWidth;
            const y = height - padding - ((point.value - minValue) / valueRange) * chartHeight;

            this.ctx.beginPath();
            this.ctx.arc(x, y, pointRadius, 0, 2 * Math.PI);
            this.ctx.fill();
        });
    }

    drawLabels() {
        if (!this.options.labels || !this.data || this.data.length === 0) return;

        const { width, height } = this.canvas;
        const { padding } = this.options;

        this.ctx.fillStyle = this.options.colors.text;
        this.ctx.font = '12px Inter, sans-serif';
        this.ctx.textAlign = 'center';

        const maxValue = Math.max(...this.data.map(d => d.value));
        const minValue = Math.min(...this.data.map(d => d.value));

        // Y-axis labels (values)
        this.ctx.textAlign = 'right';
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
            const value = minValue + (maxValue - minValue) * (i / steps);
            const y = height - padding - (i / steps) * (height - 2 * padding);
            this.ctx.fillText(Math.round(value), padding - 10, y + 4);
        }

        // X-axis labels (time or index)
        this.ctx.textAlign = 'center';
        const labelStep = Math.max(1, Math.floor(this.data.length / 5));
        this.data.forEach((point, index) => {
            if (index % labelStep === 0 || index === this.data.length - 1) {
                const x = padding + (index / (this.data.length - 1)) * (width - 2 * padding);
                const label = point.label || (index + 1).toString();
                this.ctx.fillText(label, x, height - padding + 20);
            }
        });
    }

    updateData(newData) {
        this.data = newData;
        this.render();
    }

    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        this.applyThemeColors();
        this.render();
    }
}

// Animation utilities for smooth chart updates
class ChartAnimator {
    constructor(chart, duration = 1000) {
        this.chart = chart;
        this.duration = duration;
        this.isAnimating = false;
    }

    animateToNewData(newData) {
        if (this.isAnimating) return;

        const oldData = [...this.chart.data];
        const startTime = Date.now();
        this.isAnimating = true;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / this.duration, 1);
            
            // Easing function (ease-out)
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            // Interpolate between old and new data
            const interpolatedData = newData.map((newPoint, index) => {
                const oldPoint = oldData[index] || { value: 0 };
                const value = oldPoint.value + (newPoint.value - oldPoint.value) * easeProgress;
                return { ...newPoint, value };
            });

            this.chart.updateData(interpolatedData);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.isAnimating = false;
            }
        };

        animate();
    }
}

// Real-time chart for live typing statistics
class RealtimeChart extends SimpleChart {
    constructor(canvas, options = {}) {
        super(canvas, [], {
            maxDataPoints: 50,
            autoScale: true,
            ...options
        });
        
        this.maxDataPoints = this.options.maxDataPoints;
    }

    addDataPoint(value, label = null) {
        const newPoint = {
            value: value,
            label: label || (this.data.length + 1).toString(),
            timestamp: Date.now()
        };

        this.data.push(newPoint);

        // Remove old data points if we exceed the maximum
        if (this.data.length > this.maxDataPoints) {
            this.data.shift();
        }

        // Auto-scale if enabled
        if (this.options.autoScale) {
            this.autoScaleAxis();
        }

        this.render();
    }

    autoScaleAxis() {
        if (this.data.length === 0) return;

        const values = this.data.map(d => d.value);
        const max = Math.max(...values);
        const min = Math.min(...values);
        const range = max - min;
        
        // Add 10% padding to the range
        const padding = range * 0.1;
        this.options.yAxis = {
            min: Math.max(0, min - padding),
            max: max + padding
        };
    }

    clear() {
        this.data = [];
        super.clear();
    }
}

// Export classes for global use
if (typeof window !== 'undefined') {
    window.SimpleChart = SimpleChart;
    window.ChartAnimator = ChartAnimator;
    window.RealtimeChart = RealtimeChart;
}

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SimpleChart, ChartAnimator, RealtimeChart };
}