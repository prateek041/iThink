import AI from "@/components/ai/transcript-section";
import { ModeToggle } from "@/components/theme-toggler";

export default function Home() {
  return (
    <div className="container h-full  mx-auto">
      <div className="w-full flex justify-between my-2">
        iThink
        <ModeToggle />
      </div>

      <div className="grid h-full grid-rows-8 grid-cols-2">
        <div className="row-start-4 row-end-6 col-span-full">
          <div className="flex h-full gap-x-5">
            <AI type="For" />
            {/* <AI type="Against" /> */}
          </div>
        </div>
      </div>
    </div>
  );
}
