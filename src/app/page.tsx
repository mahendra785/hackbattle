import MCQCard from "@/components/mcq";

export default function Page() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <MCQCard
        question={`Which statement about  is true?`}
        options={[
          "It is unrelated to React rendering.",
          `It helps organize for maintainability.`,
          "It always slows down performance.",
          "It cannot be used with TypeScript.",
        ]}
        correctIndex={1}
      />
    </div>
  );
}
