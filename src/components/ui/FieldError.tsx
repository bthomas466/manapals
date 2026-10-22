export default function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-danger motion-safe:animate-[errin_150ms_ease-out]">
      {message}
    </p>
  );
}
