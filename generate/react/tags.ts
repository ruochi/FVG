/**
 * React 的 JSX 会把大写标签编译成变量。
 * 这些常量是字符串，`renderReactFvg` 会原样写成 Flex Layer 标签。
 */
export const Layer = 'Layer'
export const Rect = 'Rect'
export const Circle = 'Circle'
export const Ellipse = 'Ellipse'
export const Line = 'Line'
export const Arrow = 'Arrow'
export const Polyline = 'Polyline'
export const Polygon = 'Polygon'
export const Path = 'Path'
export const Curve = 'Curve'
/** `.layer` 里的 `<draw>` 子标签；正文是 JS（ctx、el） */
export const draw = 'draw'
