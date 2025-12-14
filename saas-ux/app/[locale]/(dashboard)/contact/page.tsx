import { useTranslations } from "next-intl";

export default function ContactPage() {
  const t = useTranslations("contact");

  return (
    <div className="max-w-full  px-4 sm:px-6 lg:px-8 min-h-64 md:min-h-80">
      <section className="py-4 border-t dark:border-[#1b2430]">
        <div className="space-y-2 p-4 text-center">
          <h1 className="my-8 text-6xl font-bold">
            <span className="bg-gradient-to-r from-sky-500 via-purple-800 to-blue-600 bg-clip-text text-transparent">
              Contact Us
            </span>
          </h1>
          <p className="text-lg mt-8">
            If you have any questions or concerns, please feel free to reach out
            to us at support@getsafe360.ai. We are here to help you!
          </p>
        </div>
      </section>
    </div>
  );
}
