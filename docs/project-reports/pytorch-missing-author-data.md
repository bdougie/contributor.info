# PyTorch PRs Missing Author Data

**Query Date:** 2025-08-14  
**Repository:** pytorch/pytorch  
**Issue:** Pull requests with missing author_id, username, or avatar_url data

## Summary

Found 50 PyTorch PRs with missing author information. All affected PRs have `author_id` set to `NULL`, indicating the contributor records were never created or linked during PR ingestion.

## Affected PRs

| Database ID | GitHub ID | PR Number | Title |
|-------------|-----------|-----------|-------|
| 0a49615a-4474-451c-852b-a04f373523aa | 2718950716 | #159790 | [ROCm][Windows] Add hipcc compatibility flags to cpp_extension.py. |
| 4a6e2e18-fdc6-4c31-a404-3d582f66db73 | 2718946336 | #159789 | [MPS] Add max_unpool1d/2d/3d |
| a689f8e8-6257-4b3d-812d-d08c69d60579 | 2718906360 | #159786 | [dynamo, nested graph breaks] prevent excessive recompilations |
| 21a8f2b4-7b57-4ba5-8ff8-6ab511c312e4 | 2718893892 | #159785 | [Tests]: disable logspace tests correctly |
| caf7e6bb-e4f0-48d3-813e-e8be97c13568 | 2718737332 | #159777 | [Inductor][Triton] Support TMA before strict 3.4 cutoff |
| 818d535c-8b07-42a7-b4de-5bc9664a6e1b | 2718669971 | #159776 | Actually run the einops tests in CI |
| 3fe18ef9-d5cf-49cc-8a73-e5b7a36a8e3a | 2718646680 | #159775 | integrate kernacle into inductor |
| 983f6dc7-d7bf-455a-b87d-8df0e2d63c66 | 2718588636 | #159774 | Improve pin_memory error message clarity |
| fbedf909-7df8-484c-8150-963f486e97e1 | 2718582831 | #159773 | [ROCm] Fix Sliding Window Attention in AOTriton integration code |
| 6b1e6b39-b58a-4e16-ba41-3073e998a19b | 2718396582 | #159768 | Add binary size check to validate current limits for binaries released to pypi |
| 022f5a16-de94-44a3-9182-42a798b867cf | 2718142643 | #159767 | Docs/remove setuppy |
| f0a18da2-0e97-4fef-8546-ba92f38ae881 | 2718109928 | #159766 | Add nn.GradBank for gradient scaling |
| 1d059836-eb63-4cb6-9e31-19729462c03e | 2717544498 | #159763 | [CI] Fix xpu build failure on Windows |
| 10945ebc-bc35-46ad-add5-deba2d1398e0 | 2717290013 | #159761 | [Cutlass] Allow offsets to be passed as arguments to kernel |
| 862b5bc8-ea38-41d9-8545-83d79b3b66ee | 2717289909 | #159760 | [Cutlass] Fix wrapper code generation breakage |
| 400a746d-6ede-4481-82d8-7f2a0f1e62d5 | 2717048067 | #159758 | [xla hash update] update the pinned xla hash |
| 5cb5b9ec-7652-481b-9559-d2e492ec2016 | 2716643810 | #159752 | [dynamo][guards][refactor] Simplify type extraction from GuardManager |
| f2ac1066-8040-44a2-a5a1-a5b48f3f1e6d | 2716333142 | #159736 | Fix GroupNorm(num_groups=1) to match LayerNorm behavior |
| 3f1bba6f-3ead-4d9a-8fe8-1770cff3beba | 2716247428 | #159733 | [BE][MPS] Build metal kernels of MacOS-14+ |
| 4cebb840-334c-4bfd-ad09-acc998ed7264 | 2716247389 | #159732 | [BE] Remove macos-13 guard from bench_mps_ops |
| 7bd42f8c-2f8c-4ff1-91cd-8e5e39b62b42 | 2716247360 | #159731 | [CI][MPS] Fix compile benchmark correctness |
| c315c6dc-4a5a-4bcd-be59-d286f33543fb | 2716143359 | #159727 | refresh expected results |
| 9edee574-9fa0-44dc-af35-1060d9f14cbb | 2716065985 | #159726 | [AOTI] normalize_path_separator file path for Windows. |
| 57f88e97-9b5d-400f-b3b1-1d17209afe1a | 2715643723 | #159723 | [bucketing] Reduce CPU overhead for reduce_scatter_merge_fn_to_trace |
| 4192c626-a009-466d-bdbd-f6c895e3885f | 2715628318 | #159722 | [dynamo][source] Add special source for __code__ and __closure__ |
| 69a18598-f1fb-478a-90b9-eee6ec31652c | 2715503650 | #159721 | [nn] Add Triton-accelerated RMSNorm implementation (3.58x speedup) |
| 98a200cd-6916-483b-86fc-bf8ff95f4339 | 2715199308 | #159720 | [dynamo][source] Optimize the __func__ attr accessor |
| 55393391-01e5-4563-a0c1-8393f7148e0e | 2715165853 | #159719 | Fix warnings in triton_helpers.py |
| c2b86719-2fee-49d3-8b7d-4211dcfea2ba | 2715007505 | #159717 | [bucketing] Use max of input/output size for bucketing |
| c1ec90e7-5701-4443-86ea-39dcf3e057ad | 2714937875 | #159712 | Update RuntimeError message in is_nonzero(input) method from bool to Boolean |
| 168bc02c-9a81-4fc7-9db2-dc50180223de | 2714754450 | #159707 | [Dynamo] Fix arg ordering in tf modes |
| ab524255-03f9-4ed6-ace5-71bedb05bdeb | 2714633228 | #159702 | [BE] Fix dev warning in `Dependencies.cmake` |
| 754ecaa5-f939-4671-96ea-5a190a401c42 | 2714535096 | #159695 | Add meta kernel for sdpa_math_for_mps |
| d08a3310-85aa-414a-b6e2-03fc4e0d7009 | 2714493745 | #159690 | Back out \"[ez] get rid of unused var\" |
| b8ac909c-5713-47a3-b9ef-6f17509b24a7 | 2714489774 | #159689 | [CUDA] Skip pynvml test on platforms that don't have complete support |
| eefaf04b-7c10-4667-8ff8-0b8acbbe5fd0 | 2714468009 | #159687 | Log max_autotune exceptions |
| fd8eb0db-7c99-4c78-9910-637240b52e42 | 2714436761 | #159684 | [typing] Constrain OrderedSet generic to be Hashable |
| d76bac24-fffd-4371-af06-bb18bb3898c8 | 2714427860 | #159683 | [nativert] force resize to zero. |
| 56eb11ff-d237-4710-9cf6-3f0a7596d48d | 2714416598 | #159682 | [cuDNN] cuDNN frontend for LayerNorm RMSNorm |
| 903adb6f-eb5f-4e24-8cfd-87079b70d31a | 2714368511 | #159678 | [dynamo, nested graph breaks] support nested graph breaks x context managers |
| 1f54e8ab-4bc3-4e7f-b822-aafcc46d14e3 | 2714359741 | #159677 | Back out \"[ez] get rid of unused var\" |
| 0f5c797f-5695-4faf-8050-bb1a0b39f259 | 2714299508 | #159673 | Fix infinite loop when iterating over an empty zip |
| 6133eb22-dc56-49f8-8794-86da92ecebf6 | 2714291860 | #159672 | [CUDA] Add some more missing `@serialTest` decorators |
| 711fc7f8-9375-43d5-8f80-259609117fc4 | 2714282728 | #159671 | Revert #156868: Bring back symint check for sharding propagation cache |
| 976d7481-9df6-4329-840c-92a72b4ca0ca | 2714232424 | #159670 | gc before warming up benchmarking |
| 232b3782-927c-4c52-8874-5a53215b6cf0 | 2714221276 | #159668 | [EZ] Add linux-aarch64.yml workflow to the viable/strict blocking set |
| 2c54670b-f3d9-44e3-8979-e9b76c687776 | 2714134038 | #159666 | improve shape checks for grouped_mm |
| 79f8d6f7-0e8e-4235-b2cd-974c8376eee9 | 2714056555 | #159665 | [export] Allow comparing device w/o index with device w/ index |
| e1ada364-0632-4130-a113-906f05609f47 | 2714048891 | #159664 | Try updating ET pin in PT/PT |
| 8be58c87-1e22-4b75-ac47-fc9c30afe8f0 | 2713981800 | #159659 | [draft] allow people to use ScalarType but keep it shimmed |

## Database IDs (for bulk operations)

```
0a49615a-4474-451c-852b-a04f373523aa, 4a6e2e18-fdc6-4c31-a404-3d582f66db73, 
a689f8e8-6257-4b3d-812d-d08c69d60579, 21a8f2b4-7b57-4ba5-8ff8-6ab511c312e4,
caf7e6bb-e4f0-48d3-813e-e8be97c13568, 818d535c-8b07-42a7-b4de-5bc9664a6e1b,
3fe18ef9-d5cf-49cc-8a73-e5b7a36a8e3a, 983f6dc7-d7bf-455a-b87d-8df0e2d63c66,
fbedf909-7df8-484c-8150-963f486e97e1, 6b1e6b39-b58a-4e16-ba41-3073e998a19b,
022f5a16-de94-44a3-9182-42a798b867cf, f0a18da2-0e97-4fef-8546-ba92f38ae881,
1d059836-eb63-4cb6-9e31-19729462c03e, 10945ebc-bc35-46ad-add5-deba2d1398e0,
862b5bc8-ea38-41d9-8545-83d79b3b66ee, 400a746d-6ede-4481-82d8-7f2a0f1e62d5,
5cb5b9ec-7652-481b-9559-d2e492ec2016, f2ac1066-8040-44a2-a5a1-a5b48f3f1e6d,
3f1bba6f-3ead-4d9a-8fe8-1770cff3beba, 4cebb840-334c-4bfd-ad09-acc998ed7264,
7bd42f8c-2f8c-4ff1-91cd-8e5e39b62b42, c315c6dc-4a5a-4bcd-be59-d286f33543fb,
9edee574-9fa0-44dc-af35-1060d9f14cbb, 57f88e97-9b5d-400f-b3b1-1d17209afe1a,
4192c626-a009-466d-bdbd-f6c895e3885f, 69a18598-f1fb-478a-90b9-eee6ec31652c,
98a200cd-6916-483b-86fc-bf8ff95f4339, 55393391-01e5-4563-a0c1-8393f7148e0e,
c2b86719-2fee-49d3-8b7d-4211dcfea2ba, c1ec90e7-5701-4443-86ea-39dcf3e057ad,
168bc02c-9a81-4fc7-9db2-dc50180223de, ab524255-03f9-4ed6-ace5-71bedb05bdeb,
754ecaa5-f939-4671-96ea-5a190a401c42, d08a3310-85aa-414a-b6e2-03fc4e0d7009,
b8ac909c-5713-47a3-b9ef-6f17509b24a7, eefaf04b-7c10-4667-8ff8-0b8acbbe5fd0,
fd8eb0db-7c99-4c78-9910-637240b52e42, d76bac24-fffd-4371-af06-bb18bb3898c8,
56eb11ff-d237-4710-9cf6-3f0a7596d48d, 903adb6f-eb5f-4e24-8cfd-87079b70d31a,
1f54e8ab-4bc3-4e7f-b822-aafcc46d14e3, 0f5c797f-5695-4faf-8050-bb1a0b39f259,
6133eb22-dc56-49f8-8794-86da92ecebf6, 711fc7f8-9375-43d5-8f80-259609117fc4,
976d7481-9df6-4329-840c-92a72b4ca0ca, 232b3782-927c-4c52-8874-5a53215b6cf0,
2c54670b-f3d9-44e3-8979-e9b76c687776, 79f8d6f7-0e8e-4235-b2cd-974c8376eee9,
e1ada364-0632-4130-a113-906f05609f47, 8be58c87-1e22-4b75-ac47-fc9c30afe8f0
```

## Analysis

- **Pattern:** All recent PyTorch PRs (#159659-#159790) are missing author data entirely
- **Root Cause:** Likely an issue with GitHub API data fetching or contributor creation process
- **Impact:** PR author information is not displayed in the application for these PRs
- **Data Quality:** Systematic failure suggests a recent change in data ingestion pipeline

## Next Steps

1. Investigate GitHub API data fetching for PyTorch repository
2. Check contributor creation logic during PR ingestion
3. Implement data backfill for missing author information
4. Add validation to prevent future occurrences