import Link from "next/link";

export type BreadcrumbItem = { label: string; href?: string };

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return <nav aria-label="麵包屑" className="text-sm text-[#7a8b83]"><ol className="flex min-w-0 flex-wrap items-center gap-2">{items.map((item, index) => <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">{index > 0 && <span aria-hidden="true" className="text-[#b5c0ba]">›</span>}{item.href ? <Link href={item.href} className="hover:text-[#c1664b]">{item.label}</Link> : <span aria-current="page" className="max-w-52 truncate text-[#52655d]">{item.label}</span>}</li>)}</ol></nav>;
}
