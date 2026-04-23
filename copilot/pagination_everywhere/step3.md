Proceed to Step 3 only.

Implement the minimal shared pagination helpers.

If needed, create:

* `src/shared/types/pagination.types.ts`
* `src/shared/validation/pagination.validation.ts`
* `src/shared/utils/pagination.ts`

Requirements:

* no over-engineering
* support converting validated page/pageSize into offset/limit
* support building pagination metadata
* stay architecture-safe
* do not update module-specific code yet
