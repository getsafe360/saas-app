import { useClerk } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
export default function CTA() {
  const { openSignUp } = useClerk();

  const handleClick = () => {
    if (openSignUp) {
      openSignUp(); // Clerk modal
    } else {
      window.location.href = "/sign-up"; // fallback
    }
  };

  return (
    <div className="rounded-2xl bg-gradient-to-r from-sky-500/20 to-blue-500/20 dark:from-sky-400/10 dark:to-indigo-600/10 border border-sky-500/30 shadow-xl px-8 py-10 text-center">
        <h3 className="text-2xl md:text-3xl font-extrabold text-white mb-4">
            Want a full report &{" "}
            <span className="text-sky-400">instant</span> optimization?
        </h3>
    <p className="mb-6">
        Create your <span className="font-bold">free account</span> today and optimize any website in minutes.
    </p>
    <button
        onClick={handleClick}
        className="button-shine inline-flex items-center gap-2 px-6 py-3 text-lg font-semibold rounded-full bg-sky-600 hover:bg-sky-700 hover:cursor-pointer text-white transition duration-300 ease-in-out shadow-lg"
    >
        Create your free account <ArrowRight className="w-5 h-5" />
    </button>
    </div>
  );
}
