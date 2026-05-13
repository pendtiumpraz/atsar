// Admin — Read-only menu_items hierarchy view.
//
// Renders the menu tree returned by `menuService.listTree()` with one level
// of indentation per parent. Each row shows: icon (resolved against the
// `lucide-react` export map, same pattern as the global sidebar), label_id,
// path, required_permission, and display_order.
//
// TODO(menus): support drag-to-reorder. The reorder endpoint will live at
// `PUT /api/v1/admin/menus/reorder` (not yet implemented) and accept the
// flat list of `{ id, parentId, displayOrder }` triples after a drop.

'use client'

import * as Lucide from 'lucide-react'
import type { ComponentType } from 'react'

import type { MenuTreeNode } from '@/lib/server/services/menu.service'
import { cn } from '@/lib/utils'

/**
 * Resolve a Lucide icon component by its PascalCase name. Falls back to a
 * neutral `Circle` glyph when the name is missing or unknown, so the row
 * still renders predictably even if the DB has stale icon strings.
 */
function resolveIcon(name: string | null): ComponentType<{ className?: string }> {
  if (!name) return Lucide.Circle
  const Icon = (Lucide as unknown as Record<string, unknown>)[name]
  return (
    (Icon as ComponentType<{ className?: string }> | undefined) ?? Lucide.Circle
  )
}

interface MenuTreeProps {
  nodes: MenuTreeNode[]
}

export function MenuTree({ nodes }: MenuTreeProps) {
  if (nodes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[rgb(var(--text-muted))]">
        Belum ada menu aktif.
      </p>
    )
  }

  return (
    <ul role="tree" className="divide-y divide-[rgb(var(--border))]">
      {nodes.map((node) => (
        <MenuTreeRow key={node.id} node={node} depth={0} />
      ))}
    </ul>
  )
}

interface MenuTreeRowProps {
  node: MenuTreeNode
  depth: number
}

function MenuTreeRow({ node, depth }: MenuTreeRowProps) {
  const Icon = resolveIcon(node.icon)
  const hasChildren = node.children.length > 0

  return (
    <li role="treeitem" aria-expanded={hasChildren ? true : undefined}>
      <div
        className={cn(
          'flex flex-wrap items-center gap-3 py-2.5 text-sm',
          // 1.25rem (20px) per depth level keeps the indent legible on mobile.
          depth > 0 && 'border-l border-[rgb(var(--border))]',
        )}
        style={{ paddingLeft: `${depth * 1.25 + 0.25}rem` }}
      >
        <Icon className="h-4 w-4 shrink-0 text-[rgb(var(--text-muted))]" />

        <span className="font-medium text-[rgb(var(--text))]">{node.labelId}</span>

        {node.path && (
          <code className="rounded bg-[rgb(var(--bg-elevated))] px-1.5 py-0.5 font-mono text-xs text-[rgb(var(--text-muted))]">
            {node.path}
          </code>
        )}

        {node.requiredPermission && (
          <span className="rounded border border-[rgb(var(--border))] px-1.5 py-0.5 text-xs text-[rgb(var(--text-muted))]">
            perm: {node.requiredPermission}
          </span>
        )}

        <span className="ml-auto shrink-0 text-xs tabular-nums text-[rgb(var(--text-muted))]">
          #{node.displayOrder}
        </span>
      </div>

      {hasChildren && (
        <ul role="group" className="divide-y divide-[rgb(var(--border))]">
          {node.children.map((child) => (
            <MenuTreeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}
