import { compile } from '@vue/compiler-dom'
import * as VueRuntime from '@vue/runtime-core'
import { createRenderer, createVNode, defineComponent, type RendererElement } from '@vue/runtime-core'
import {
  createHostElement,
  createHostText,
  serializeFvgDocument,
  type FvgHostChild,
  type FvgHostElement,
} from '../serialize.js'

const SKIP_PROP = new Set(['key', 'ref', 'ref_for', 'ref_key', 'class'])

export type VueFvgComponent = {
  props?: unknown
  template?: string
  components?: Record<string, VueFvgComponent>
  setup?: (...args: never[]) => Record<string, unknown>
  render?: (...args: never[]) => unknown
  [key: string]: unknown
}

export type VueFvgOptions = {
  template: string
  bindings?: Record<string, unknown>
  components?: Record<string, VueFvgComponent>
}

type HostNode = FvgHostElement | FvgHostText

function parentNode(node: HostNode): FvgHostElement | null {
  return 'parent' in node ? (node.parent as FvgHostElement | null) : null
}

function patchProp(el: FvgHostElement, key: string, _prev: unknown, next: unknown): void {
  if (SKIP_PROP.has(key) || key.startsWith('on')) return
  if (next == null || next === false) delete el.props[key]
  else el.props[key] = next
}

function insert(child: HostNode, parent: FvgHostElement, anchor?: HostNode | null): void {
  const c = child as HostNode & { parent?: FvgHostElement | null }
  if (c.parent) remove(child)
  c.parent = parent
  if (anchor) {
    const index = parent.children.indexOf(anchor)
    if (index >= 0) {
      parent.children.splice(index, 0, child)
      return
    }
  }
  parent.children.push(child)
}

function remove(child: HostNode): void {
  const c = child as HostNode & { parent?: FvgHostElement | null }
  const parent = c.parent
  if (!parent) return
  const index = parent.children.indexOf(child)
  if (index >= 0) parent.children.splice(index, 1)
  c.parent = null
}

function nextSibling(node: HostNode): HostNode | null {
  const parent = parentNode(node)
  if (!parent) return null
  const index = parent.children.indexOf(node)
  return (parent.children[index + 1] as HostNode | undefined) ?? null
}

function setText(node: HostNode, text: string): void {
  if (node.kind === 'text') node.text = text
}

function setElementText(el: FvgHostElement, text: string): void {
  for (const child of el.children) {
    const c = child as FvgHostChild & { parent?: FvgHostElement | null }
    c.parent = undefined
  }
  el.children = text ? [Object.assign(createHostText(text), { parent: el })] : []
}

function cloneNode(node: HostNode): HostNode {
  if (node.kind === 'text') return createHostText(node.text)
  const copy = createHostElement(node.tag)
  copy.props = { ...node.props }
  copy.children = node.children.map((child) => {
    const cloned = cloneNode(child as HostNode) as HostNode & { parent?: FvgHostElement }
    cloned.parent = copy
    return cloned
  })
  return copy
}

const { render } = createRenderer<HostNode, FvgHostElement>({
  patchProp,
  insert,
  remove,
  createElement: (tag) => Object.assign(createHostElement(tag), { parent: null as FvgHostElement | null }),
  createText: (text) => createHostText(text),
  createComment: (text) => createHostText(`<!--${text}-->`),
  setText,
  setElementText,
  parentNode,
  nextSibling,
  querySelector: () => null,
  setScopeId: () => {},
  cloneNode,
  insertStaticContent(content, parent, anchor) {
    const node = createHostText(content)
    insert(node, parent, anchor)
    return [node, node]
  },
})

type RenderFn = (ctx: unknown, cache: unknown) => unknown

function compileRender(template: string, componentNames: Set<string>): RenderFn {
  let code = ''
  try {
    code = compile(template.trim(), {
      isCustomElement: (tag) => !componentNames.has(tag),
    }).code
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`FVG 模板编译失败: ${message}`)
  }
  const factory = new Function('Vue', code) as (vue: typeof VueRuntime) => RenderFn
  return factory(VueRuntime)
}

function prepareComponent(
  comp: VueFvgComponent,
  registry: Record<string, VueFvgComponent>,
  seen: WeakMap<object, VueFvgComponent>,
): VueFvgComponent {
  const cached = seen.get(comp)
  if (cached) return cached
  const next: VueFvgComponent = { ...comp }
  seen.set(comp, next)
  if (comp.components) {
    const prepared: Record<string, VueFvgComponent> = {}
    for (const [name, child] of Object.entries(comp.components)) {
      prepared[name] = prepareComponent(child, { ...registry, ...prepared }, seen)
      registry[name] = prepared[name]
    }
    next.components = prepared
  }
  if (typeof comp.template === 'string' && typeof comp.render !== 'function') {
    const names = new Set([...Object.keys(registry), ...Object.keys(next.components ?? {})])
    next.render = compileRender(comp.template, names)
    delete next.template
  }
  return next
}

function prepareComponents(components: Record<string, VueFvgComponent>): Record<string, VueFvgComponent> {
  const seen = new WeakMap<object, VueFvgComponent>()
  const registry: Record<string, VueFvgComponent> = {}
  const prepared: Record<string, VueFvgComponent> = {}
  for (const [name, comp] of Object.entries(components)) {
    prepared[name] = prepareComponent(comp, registry, seen)
    registry[name] = prepared[name]
  }
  return prepared
}

/** Vue 模板 → FVG 文本。未注册的标签按原样输出，PascalCase 组件在 components 里注册。 */
export function renderVueFvg(options: VueFvgOptions): string {
  const components = prepareComponents(options.components ?? {})
  const componentNames = new Set(Object.keys(components))
  const renderFn = compileRender(options.template, componentNames)
  const container = Object.assign(createHostElement('container'), { parent: null as FvgHostElement | null })
  const vnode = createVNode(
    defineComponent({
      components,
      data() {
        return { ...(options.bindings ?? {}) }
      },
      render: renderFn,
    }),
  )
  render(vnode, container as unknown as RendererElement)
  const roots = container.children.filter((c): c is FvgHostElement => c.kind === 'el')
  if (roots.length !== 1) throw new Error('模板需要一个 <fvg> 根元素')
  return serializeFvgDocument(roots[0]!)
}
