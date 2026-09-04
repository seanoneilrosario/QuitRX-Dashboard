import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import StaffLoginForm from "./StaffLoginForm";
import styles from "./staffLogin.module.css";

export const metadata: Metadata = { title: "Staff sign in | QuitRX" };

export default async function StaffLoginPage() {
  const session = await auth();
  if (session?.user && (session.user as typeof session.user & { isStaff?: boolean }).isStaff) {
    redirect("/dashboard");
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link className={styles.brand} href="/dashboard" aria-label="Go to QuitRX dashboard" style={{ color: "inherit", textDecoration: "none" }}><span>Q</span><strong>QuitRX</strong></Link>
        <p className={styles.eyebrow}>Staff portal</p>
        <h1>Welcome back</h1>
        <p className={styles.intro}>Enter your QuitHero staff credentials to access store operations.</p>
        <StaffLoginForm />
        <p className={styles.note}>This login is for authorised staff only.</p>
      </section>
    </main>
  );
}
