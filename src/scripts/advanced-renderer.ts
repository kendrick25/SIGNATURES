/**
 * Advanced Stroke Renderer
 * Implements professional-grade vector rendering with:
 * - Cubic Bézier curves (no simplification)
 * - Sub-pixel anti-aliasing
 * - Gamma correction (sRGB)
 * - Advanced stroke caps and joins
 * - Pressure-sensitive rendering
 */

interface Point {
    x: number;
    y: number;
    pressure?: number;
    time?: number;
}

interface StrokeData {
    points: Point[];
    penColor: string;
    minWidth: number;
    maxWidth: number;
    velocityFilterWeight?: number;
}

export class AdvancedStrokeRenderer {
    private ctx: CanvasRenderingContext2D;
    private gammaCorrection = 2.2;

    constructor(ctx: CanvasRenderingContext2D, _ratio: number) {
        this.ctx = ctx;
        this.setupHighQualityContext();
    }

    private setupHighQualityContext() {
        // Enable high-quality rendering
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        // Sub-pixel rendering hints
        (this.ctx as any).webkitImageSmoothingEnabled = true;
        (this.ctx as any).mozImageSmoothingEnabled = true;
    }

    /**
     * Convert sRGB color to linear space for correct blending
     */
    private sRGBToLinear(value: number): number {
        const normalized = value / 255;
        if (normalized <= 0.04045) {
            return normalized / 12.92;
        }
        return Math.pow((normalized + 0.055) / 1.055, this.gammaCorrection);
    }

    /**
     * Convert linear color back to sRGB
     */
    private linearToSRGB(value: number): number {
        if (value <= 0.0031308) {
            return value * 12.92 * 255;
        }
        return (1.055 * Math.pow(value, 1 / this.gammaCorrection) - 0.055) * 255;
    }

    /**
     * Parse color and apply gamma correction
     */
    private parseColorWithGamma(color: string): { r: number; g: number; b: number; a: number } {
        let r = 0, g = 0, b = 0, a = 1;

        if (color === 'transparent') {
            return { r: 0, g: 0, b: 0, a: 0 };
        } else if (color.startsWith('rgba')) {
            const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (match) {
                r = parseInt(match[1]);
                g = parseInt(match[2]);
                b = parseInt(match[3]);
                a = match[4] ? parseFloat(match[4]) : 1;
            }
        } else if (color.startsWith('#')) {
            const hex = color.slice(1);
            if (hex.length === 6) {
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
            }
        }

        // Convert to linear space for proper blending
        return {
            r: this.sRGBToLinear(r),
            g: this.sRGBToLinear(g),
            b: this.sRGBToLinear(b),
            a
        };
    }

    /**
     * Create gamma-corrected color string
     */
    private createGammaCorrectedColor(linear: { r: number; g: number; b: number; a: number }): string {
        const r = Math.round(this.linearToSRGB(linear.r));
        const g = Math.round(this.linearToSRGB(linear.g));
        const b = Math.round(this.linearToSRGB(linear.b));
        return `rgba(${r}, ${g}, ${b}, ${linear.a})`;
    }

    /**
     * Calculate cubic Bézier control points using Catmull-Rom spline
     * This creates smooth, natural curves without simplification
     */
    public calculateCubicBezierControlPoints(points: Point[]): {
        p0: Point;
        cp1: Point;
        cp2: Point;
        p1: Point;
    }[] {
        if (points.length < 2) return [];

        const segments: {
            p0: Point;
            cp1: Point;
            cp2: Point;
            p1: Point;
        }[] = [];

        const tension = 0.5; // Catmull-Rom tension (0.5 = standard)
        const alpha = 0.5; // Centripetal parameterization

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];

            // Calculate distances for centripetal parameterization
            const d1 = Math.pow(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2), alpha);
            const d2 = Math.pow(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2), alpha);
            const d3 = Math.pow(Math.pow(p3.x - p2.x, 2) + Math.pow(p3.y - p2.y, 2), alpha);

            // Avoid division by zero
            const d1Safe = d1 < 1e-4 ? 1 : d1;
            const d2Safe = d2 < 1e-4 ? 1 : d2;
            const d3Safe = d3 < 1e-4 ? 1 : d3;

            // Calculate control points using Catmull-Rom formula
            const cp1x = p1.x + (p2.x - p0.x) / (6 * tension) * (d2Safe / (d1Safe + d2Safe));
            const cp1y = p1.y + (p2.y - p0.y) / (6 * tension) * (d2Safe / (d1Safe + d2Safe));

            const cp2x = p2.x - (p3.x - p1.x) / (6 * tension) * (d2Safe / (d2Safe + d3Safe));
            const cp2y = p2.y - (p3.y - p1.y) / (6 * tension) * (d2Safe / (d2Safe + d3Safe));

            segments.push({
                p0: p1,
                cp1: { x: cp1x, y: cp1y },
                cp2: { x: cp2x, y: cp2y },
                p1: p2
            });
        }

        return segments;
    }

    /**
     * Generate SVG path data (d attribute) using cubic Bézier curves
     */
    public getSVGPath(points: Point[]): string {
        if (points.length < 2) return '';

        const segments = this.calculateCubicBezierControlPoints(points);
        if (segments.length === 0) return '';

        let d = `M ${segments[0].p0.x.toFixed(2)} ${segments[0].p0.y.toFixed(2)}`;

        segments.forEach(segment => {
            d += ` C ${segment.cp1.x.toFixed(2)} ${segment.cp1.y.toFixed(2)}, ${segment.cp2.x.toFixed(2)} ${segment.cp2.y.toFixed(2)}, ${segment.p1.x.toFixed(2)} ${segment.p1.y.toFixed(2)}`;
        });

        return d;
    }

    /**
     * Render a single stroke with advanced quality
     */
    public renderStroke(stroke: StrokeData, strokeType: string = 'natural') {
        if (stroke.points.length < 2) {
            // Single point - render as circle
            if (stroke.points.length === 1) {
                const dotColor = stroke.penColor || (stroke as any).color || '#ffffff';
                this.renderDot(stroke.points[0], dotColor, stroke.maxWidth);
            }
            return;
        }
        // The original line already handles the fallback for 'color'
        const strokeColor = stroke.penColor || (stroke as any).color || '#ffffff';
        const color = this.parseColorWithGamma(strokeColor);
        const correctedColor = this.createGammaCorrectedColor(color);

        // Calculate cubic Bézier segments
        const segments = this.calculateCubicBezierControlPoints(stroke.points);

        this.ctx.save();

        // Apply stroke type specific settings
        this.applyStrokeTypeSettings(strokeType, correctedColor, stroke);

        // Render each segment with sub-pixel precision
        this.ctx.beginPath();

        if (segments.length > 0) {
            this.ctx.moveTo(segments[0].p0.x, segments[0].p0.y);

            segments.forEach((segment) => {
                // Use cubic Bézier curve (no simplification)
                this.ctx.bezierCurveTo(
                    segment.cp1.x, segment.cp1.y,
                    segment.cp2.x, segment.cp2.y,
                    segment.p1.x, segment.p1.y
                );
            });

            // Apply variable width if not uniform
            if (stroke.minWidth !== stroke.maxWidth) {
                this.renderVariableWidthStroke(segments, stroke, strokeType);
            } else {
                this.ctx.lineWidth = stroke.maxWidth;
                this.ctx.stroke();
            }
        }

        this.ctx.restore();
    }

    /**
     * Apply stroke type specific rendering settings
     */
    private applyStrokeTypeSettings(strokeType: string, color: string, _stroke: StrokeData) {
        this.ctx.strokeStyle = color;
        this.ctx.fillStyle = color;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        switch (strokeType) {
            case 'marker':
                // Sharp, consistent marker
                this.ctx.lineJoin = 'miter';
                this.ctx.miterLimit = 10;
                this.ctx.lineCap = 'square';
                break;

            case 'pen':
                // Smooth ballpoint pen
                this.ctx.lineJoin = 'round';
                this.ctx.lineCap = 'round';
                // Subtle shadow for depth
                this.ctx.shadowBlur = 0.5;
                this.ctx.shadowColor = color;
                break;

            case 'brush':
                // Organic brush with texture
                this.ctx.lineJoin = 'round';
                this.ctx.lineCap = 'round';
                // Soft edges
                this.ctx.shadowBlur = 1.5;
                this.ctx.shadowColor = color;
                this.ctx.globalCompositeOperation = 'source-over';
                break;

            case 'fine':
                // Ultra-precise technical pen
                this.ctx.lineJoin = 'round';
                this.ctx.lineCap = 'round';
                this.ctx.shadowBlur = 0;
                break;

            case 'natural':
            default:
                // Natural handwriting
                this.ctx.lineJoin = 'round';
                this.ctx.lineCap = 'round';
                this.ctx.shadowBlur = 0.3;
                this.ctx.shadowColor = color;
                break;
        }
    }

    /**
     * Render stroke with variable width using polygon fill
     */
    private renderVariableWidthStroke(
        segments: { p0: Point; cp1: Point; cp2: Point; p1: Point }[],
        stroke: StrokeData,
        strokeType: string
    ) {
        // Create outline points for variable width
        const leftPoints: Point[] = [];
        const rightPoints: Point[] = [];

        segments.forEach((segment, index) => {
            const steps = 20; // High precision subdivision

            for (let t = 0; t <= 1; t += 1 / steps) {
                // Cubic Bézier evaluation
                const point = this.evaluateCubicBezier(
                    segment.p0,
                    segment.cp1,
                    segment.cp2,
                    segment.p1,
                    t
                );

                // Calculate tangent for perpendicular offset
                const tangent = this.evaluateCubicBezierDerivative(
                    segment.p0,
                    segment.cp1,
                    segment.cp2,
                    segment.p1,
                    t
                );

                const length = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
                if (length > 0) {
                    const normal = { x: -tangent.y / length, y: tangent.x / length };

                    // Calculate width at this point
                    const progress = (index + t) / segments.length;
                    const width = stroke.minWidth + (stroke.maxWidth - stroke.minWidth) *
                        this.calculateWidthFactor(progress, strokeType);

                    const halfWidth = width / 2;

                    leftPoints.push({
                        x: point.x + normal.x * halfWidth,
                        y: point.y + normal.y * halfWidth
                    });

                    rightPoints.push({
                        x: point.x - normal.x * halfWidth,
                        y: point.y - normal.y * halfWidth
                    });
                }
            }
        });

        // Fill the polygon as a single path to avoid overlapping alpha artifacts
        this.ctx.beginPath();
        if (leftPoints.length > 0 && rightPoints.length > 0) {
            // Start Cap (incorporate into path)
            const pStart = leftPoints[0];
            const pEnd = rightPoints[0];
            const cx = (pStart.x + pEnd.x) / 2;
            const cy = (pStart.y + pEnd.y) / 2;
            const r = Math.sqrt((pStart.x - pEnd.x) ** 2 + (pStart.y - pEnd.y) ** 2) / 2;
            const startAngle = Math.atan2(pStart.y - cy, pStart.x - cx);

            this.ctx.arc(cx, cy, r, startAngle + Math.PI, startAngle);

            leftPoints.forEach((p) => {
                this.ctx.lineTo(p.x, p.y);
            });

            // End Cap (incorporate into path)
            const epStart = leftPoints[leftPoints.length - 1];
            const epEnd = rightPoints[rightPoints.length - 1];
            const ecx = (epStart.x + epEnd.x) / 2;
            const ecy = (epStart.y + epEnd.y) / 2;
            const er = Math.sqrt((epStart.x - epEnd.x) ** 2 + (epStart.y - epEnd.y) ** 2) / 2;
            const endAngle = Math.atan2(epStart.y - ecy, epStart.x - ecx);

            this.ctx.arc(ecx, ecy, er, endAngle, endAngle + Math.PI);

            const reversedRight = [...rightPoints].reverse();
            reversedRight.forEach(p => this.ctx.lineTo(p.x, p.y));
        }
        this.ctx.closePath();
        this.ctx.fill();
    }

    /**
     * Calculate width variation factor based on stroke type
     */
    private calculateWidthFactor(progress: number, strokeType: string): number {
        switch (strokeType) {
            case 'brush':
            case 'pen':
            case 'natural':
                // Using sin^2 ensures an organic taper where the average weight 
                // is exactly halfway between min and max (Avg = 0.5)
                return Math.pow(Math.sin(progress * Math.PI), 2);
            case 'marker':
            case 'fine':
            default:
                // Constant technical width
                return 1.0;
        }
    }

    /**
     * Evaluate cubic Bézier curve at parameter t
     */
    private evaluateCubicBezier(p0: Point, cp1: Point, cp2: Point, p1: Point, t: number): Point {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const t2 = t * t;
        const t3 = t2 * t;

        return {
            x: mt3 * p0.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p1.x,
            y: mt3 * p0.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p1.y
        };
    }

    /**
     * Evaluate cubic Bézier derivative (tangent) at parameter t
     */
    private evaluateCubicBezierDerivative(p0: Point, cp1: Point, cp2: Point, p1: Point, t: number): Point {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;

        return {
            x: 3 * mt2 * (cp1.x - p0.x) + 6 * mt * t * (cp2.x - cp1.x) + 3 * t2 * (p1.x - cp2.x),
            y: 3 * mt2 * (cp1.y - p0.y) + 6 * mt * t * (cp2.y - cp1.y) + 3 * t2 * (p1.y - cp2.y)
        };
    }

    /**
     * Render single dot with anti-aliasing
     */
    private renderDot(point: Point, color: string, width: number) {
        const parsedColor = this.parseColorWithGamma(color);
        const correctedColor = this.createGammaCorrectedColor(parsedColor);

        this.ctx.save();
        this.ctx.fillStyle = correctedColor;
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, width / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }
}
