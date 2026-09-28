import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createItem, listItems } from '@/lib/backend';
import { config } from '@/lib/config';
import { parseCreateItemInput, ValidationError } from '@/lib/validate';

/**
 * The items page: the ordinary half of the reference.
 *
 * It is rendered on the server, which is what lets it read the backend
 * directly through lib/backend.ts. The browser receives finished HTML and
 * never learns that xms-backend exists.
 *
 * The form posts to a Server Action rather than to fetch(). Same BFF, same
 * validation, same typed client — but it works with JavaScript disabled, and
 * it means the round trip you are about to watch has no client-side code in
 * it at all. `app/api/items/route.ts` is the same capability over HTTP, for
 * anything that does need to call it from the browser.
 */

export const dynamic = 'force-dynamic';

async function createItemAction(formData: FormData): Promise<void> {
  'use server';

  let input;
  try {
    input = parseCreateItemInput({
      name: formData.get('name'),
      note: formData.get('note'),
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      // A bad form is the user's business, so it comes back to the form.
      redirect(`/?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }

  // Not wrapped. An upstream failure here is the platform's business and
  // must not be dressed up as a validation message: it throws, and the error
  // boundary shows it.
  await createItem(input);

  revalidatePath('/');
  redirect('/');
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Rendered on the server, so a fixed UTC format rather than the machine's
  // locale — otherwise the string depends on which pod answered.
  return `${d.toISOString().slice(0, 19).replace('T', ' ')}Z`;
}

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, items, cfg] = await Promise.all([
    searchParams,
    listItems(50),
    Promise.resolve(config()),
  ]);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">xms-frontend</span>
        <h1>Items</h1>
        <p>
          Read from and written to <code>xms-backend</code>, which owns the
          table. This page never touches a database; it asks a service that
          does, over cluster DNS, from the server. For the evidence that this
          is what actually happens, see the{' '}
          <Link href="/platform">platform proof page</Link>.
        </p>
      </div>

      {error ? (
        <div className="callout callout-fail" role="alert" style={{ marginBottom: 20 }}>
          <strong>Rejected before it left this service.</strong> {error}
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h2>Create an item</h2>
          <span className="meta-line">
            Server Action → <code>lib/backend.ts</code> → <code>POST /items</code>
          </span>
        </div>
        <div className="panel-body">
          <form action={createItemAction}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  maxLength={200}
                  placeholder="Something to store"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="note">Note (optional)</label>
                <input
                  id="note"
                  name="note"
                  type="text"
                  maxLength={2000}
                  placeholder="Any detail worth keeping"
                  autoComplete="off"
                />
              </div>
              <button className="primary" type="submit">
                Create
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </h2>
          <span className="meta-line">
            <code>GET {cfg.upstreams.backend.url}/items?limit=50</code>
          </span>
        </div>
        {items.length === 0 ? (
          <div className="panel-body">
            <p className="none">
              No items yet. Create one above — it round-trips through this
              service to the backend and comes back on the next render.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="items">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Name</th>
                  <th scope="col">Note</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="id">{item.id}</td>
                    <td>{item.name}</td>
                    <td>{item.note ?? <span className="none">—</span>}</td>
                    <td className="when">{formatWhen(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
