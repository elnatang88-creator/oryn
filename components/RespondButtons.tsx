import { respondAction } from '@/app/actions/connections'

/** Two separate forms: the decision travels in a hidden field, never inferred from which button was pressed. */
export function RespondButtons({ id }: { id: string }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <form action={respondAction}>
        <input type="hidden" name="id" value={id} /><input type="hidden" name="decision" value="accept" />
        <button className="btn-connect w-full" data-testid="accept-request">Connect</button>
      </form>
      <form action={respondAction}>
        <input type="hidden" name="id" value={id} /><input type="hidden" name="decision" value="decline" />
        <button className="btn-quiet w-full border border-soft-200">Not now</button>
      </form>
    </div>
  )
}
