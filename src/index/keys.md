---
title: "keys"
icon: key
date: 2024-05-20
updated: 2025-12-25
description: "Public keys for verifying my digital identity."
url: /keys/
tags: ["meta"]
templateEngine: [vto, md]
---

## SSH

I don’t use PGP, but you might want to check [age-encryption](https://age-encryption.org/#encrypting-to-a-github-user) as an encryption method for sensitive information you might send me over insecure channels.

<!-- dprint-ignore-start -->
- [codeberg.org/{{ author.username }}.keys](https://codeberg.org/{{ author.username }}.keys)
- [github.com/{{ author.username }}.keys](https://github.com/{{ author.username }}.keys)
- [gitlab.com/{{ author.username }}.keys](https://gitlab.com/{{ author.username }}.keys)
- [meta.sr.ht/~{{ author.username }}.keys](https://meta.sr.ht/~{{ author.username }}.keys)
<!-- dprint-ignore-end -->

### authentication

#### public authentication key of bilgisayar

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPaYomkrkg+WhBBuHrrPqCxqB2GRhqmLt5DJzQkjwalD
SHA256:TWsRn9tVypISAdtSi1OgpmEuGIEEGVZHpOpp8oW7W+g
```

#### public authentication key of telefon

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOLDNi3uml+sIXth4B9rQslnqW3gc+yi6HesuveBisVs
SHA256:ib7FCqCTFCAbsqZMh2f/HO0oAEVuhUN14AnkYSwbkz0
```

### signing

This info is also available at [Codeberg](https://codeberg.org/{{ author.username }}/{{ author.username }}), [GitLab](https://gitlab.com/{{ author.username }}/{{ author.username }}), [GitHub](https://github.com/{{ author.username }}/{{ author.username }}) & [sourcehut](https://git.sr.ht/~{{ author.username }}/{{ author.username }}). All four repositories should be identical and show commits signed with one of the keys below.

#### public signing key of bilgisayar

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFThAK4bQKmz31+wv5lAK5BF1QLf0CT/qhr30iPtmiGT
SHA256:vTcqXW1b3WaQYtLRhr5MBH1MoCWfivG/pcRKOhvHdOg
```

#### public signing key of telefon

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIF2XufuZr7u5/Yj4/qbkOBr7pbM3kCYQ6rlIKCPST5q3
SHA256:jxjLBvJOoot2eFpcwjjD8uyolNQjWwWEJhKzrmN95ew
```

For the HTML page, you can [clone the site source](https://codeberg.org/{{ author.username }}/{{ site.host }}) and verify the commit history for the [`./src{{ page.src.path }}{{ page.src.ext }}`](https://codeberg.org/{{ author.username }}/{{ site.host }}/src/branch/main/src{{ page.src.path }}{{ page.src.ext }}) file.

## Matrix

- **[@{{ author.social.matrix.username }}:{{ author.social.matrix.metropolis.host }}](https://matrix.to/#/@{{ author.social.matrix.username }}:{{ author.social.matrix.metropolis.host }})**
  - `7jA7yS1uVD` (Element Desktop)
  - `9ovMRDnfeY` (Element X Android)

- **[@{{ author.social.matrix.username }}:{{ author.social.matrix.envs.host }}](https://matrix.to/#/@{{ author.social.matrix.username }}:{{ author.social.matrix.envs.host }})**
  - `XLSNVDORMQ` (Element X Android)
