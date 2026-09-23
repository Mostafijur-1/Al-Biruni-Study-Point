import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { FacebookIcon } from "@/components/icons/FacebookIcon";
import { PageHeader } from "@/components/shared/PageHeader";
import { buttonVariants, pressableClasses } from "@/components/ui/button-variants";
import { formatPhoneDisplay, phoneTelHref } from "@/lib/format/phone";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { FACEBOOK_PAGE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

type ContactSectionProps = {
  contact: Dictionary["contact"];
};

export function ContactSection({ contact }: ContactSectionProps) {
  const primaryPhone = contact.phones[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12 lg:px-6 lg:py-16">
      <PageHeader eyebrow={contact.eyebrow} title={contact.title} description={contact.subtitle} />

      <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="space-y-4">
          <article className="rounded-xl border-2 border-border border-t-4 border-t-brand-yellow bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-primary">{contact.addressTitle}</h2>
                <address className="mt-3 space-y-1 text-sm not-italic leading-7 text-foreground sm:text-base">
                  {contact.addressLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </address>
                <p className="mt-3 text-xs text-muted">{contact.mapHint}</p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-red/10 text-brand-red">
                <Phone className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-bold text-primary">{contact.phoneTitle}</h2>
                <ul className="mt-3 space-y-2">
                  {contact.phones.map((phone) => (
                    <li key={phone}>
                      <a
                        href={phoneTelHref(phone)}
                        className={cn(
                          pressableClasses,
                          "inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-base font-semibold text-primary hover:border-primary hover:bg-secondary",
                        )}
                      >
                        <Phone className="size-4 shrink-0 text-brand-red" />
                        {formatPhoneDisplay(phone)}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#1877F2]/10 text-[#1877F2]">
                <FacebookIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-bold text-primary">{contact.facebookTitle || "ফেসবুক পেজ"}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {contact.facebookSubtitle || "ক্লাস আপডেট, রুটিন ও নোটিশ পেতে আমাদের অফিশিয়াল ফেসবুক পেজ ফলো করুন।"}
                </p>
                <div className="mt-3">
                  <a
                    href={FACEBOOK_PAGE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      pressableClasses,
                      "inline-flex items-center gap-2 rounded-lg border border-[#1877F2]/30 bg-[#1877F2]/10 px-4 py-2 text-sm font-semibold text-[#1877F2] transition hover:bg-[#1877F2] hover:text-white",
                    )}
                  >
                    <FacebookIcon className="size-4 shrink-0" />
                    {contact.facebookCta || "ফেসবুক পেজে যান"}
                  </a>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/30 text-accent-foreground">
                <Mail className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-bold text-primary">{contact.emailTitle}</h2>
                <a
                  href={`mailto:${contact.email}`}
                  className="mt-3 inline-block break-all text-base font-semibold text-brand-red underline-offset-4 hover:underline"
                >
                  {contact.email}
                </a>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-secondary/60 px-5 py-4">
            <div className="flex items-center gap-3">
              <Clock className="size-5 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">{contact.hoursTitle}</p>
                <p className="mt-1 text-sm font-medium text-foreground">{contact.hours}</p>
              </div>
            </div>
          </article>
        </div>

        <aside className="flex flex-col justify-between gap-6 rounded-xl border-2 border-primary/20 bg-[linear-gradient(160deg,#fff9e6_0%,#ffffff_50%,#e8f4fc_100%)] p-6 shadow-[var(--shadow-md)] dark:bg-[linear-gradient(160deg,#172536_0%,#162331_52%,#201d2a_100%)] sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-accent">ABSP</p>
            <h2 className="font-display mt-2 text-2xl font-bold text-primary sm:text-3xl">
              {"ভর্তি ও পরামর্শ"}
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted sm:text-base">
              {"ভর্তি, ব্যাচ বা কোর্স সম্পর্কে জানতে আজই যোগাযোগ করো অথবা ফেসবুক পেজে যুক্ত থাকো।"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <a
              href={phoneTelHref(primaryPhone)}
              className={cn(buttonVariants({ size: "lg" }), "justify-center")}
            >
              <Phone className="size-4" />
              {contact.ctaCall}
            </a>

            <a
              href={FACEBOOK_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "justify-center gap-2 border-[#1877F2]/40 bg-white/70 text-[#1877F2] transition hover:border-[#1877F2] hover:bg-[#1877F2] hover:text-white dark:bg-card/70",
              )}
            >
              <FacebookIcon className="size-5 shrink-0" />
              {"ফেসবুক পেজ ফলো করুন"}
            </a>
          </div>

          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              "Jamgora Fantasy Kingdom Ashulia Savar Dhaka",
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "secondary", size: "default" }),
              "w-full justify-center text-center",
            )}
          >
            <MapPin className="size-4" />
            {"গুগল ম্যাপে দেখো"}
          </a>
        </aside>
      </div>
    </div>
  );
}
