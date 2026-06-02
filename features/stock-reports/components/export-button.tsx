'use client'

import { Icon } from '@/components/ui'
import styles from './stock-reports.module.scss'

interface Props {
  data:     Record<string, unknown>[]
  filename: string
  canExport:boolean
}

export function ExportButton({ data, filename, canExport }: Props) {
  if (!canExport || data.length === 0) return null

  function exportCsv() {
    if (data.length === 0) return
    const headers = Object.keys(data[0]!)
    const rows    = data.map(r =>
      headers.map(h => {
        const v = r[h]
        if (v == null) return ''
        const s = String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s
      }).join(',')
    )
    const csv  = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button className={styles.exportBtn} onClick={exportCsv} type="button" title="Export as CSV">
      <Icon name="download" size={14} /> Export CSV
    </button>
  )
}
