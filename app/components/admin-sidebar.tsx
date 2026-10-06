"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const adminLinks = [
  { href: "/", label: "Dashboard", icon: "⌂" },
  { href: "/schedules", label: "Schedules", icon: "▦" },
  { href: "/schedules-areas", label: "By area", icon: "⌖" },
  { href: "/areas", label: "Service areas", icon: "◎" },
  { href: "/outage", label: "Outages", icon: "ϟ" },
  { href: "/substation", label: "Substations", icon: "⌁" },
  { href: "/feeder", label: "Feeders", icon: "⌇" },
  { href: "/zone", label: "Zones", icon: "◇" },
  { href: "/payments", label: "Payments", icon: "৳" },
  { href: "/users", label: "Users", icon: "♙" },
  { href: "/admin", label: "Admin", icon: "⚙" },
  { href: "/analytics", label: "Analytics", icon: "▥" },
  { href: "/audit-log", label: "Audit log", icon: "≡" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar" aria-label="Administrator navigation">
      <span className="admin-sidebar-heading">WORKSPACE</span>
      <nav className="admin-sidebar-nav">
        {adminLinks.map(({ href, label, icon }) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link aria-current={active ? "page" : undefined} className={active ? "admin-sidebar-link active" : "admin-sidebar-link"} href={href} key={href}>
              <span aria-hidden="true" className="admin-sidebar-icon">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
