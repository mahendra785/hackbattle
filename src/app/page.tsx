// app/page.tsx
"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") return <p>Loading...</p>;

  return (
    <main style={{ padding: 24 }}>
      {session?.user ? (
        <>
          <p>
            Signed in as {session.user.name} ({session.user.email})
          </p>
          <img
            src={session.user.image ?? ""}
            alt=""
            width={48}
            height={48}
            style={{ borderRadius: 999 }}
          />
          <br />
          <button onClick={() => signOut()}>Sign out</button>
        </>
      ) : (
        <>
          <p>Not signed in</p>
          <button onClick={() => signIn("google")}>Sign in with Google</button>
        </>
      )}
    </main>
  );
}
