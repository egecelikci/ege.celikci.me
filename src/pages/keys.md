---
layout: page
title: "keys"
permalink: /keys/
---

## SSH

I don’t use PGP, but you might want to check [age-encryption](https://age-encryption.org/#encrypting-to-a-github-user) as an encryption method for sensitive information you might send me over insecure channels.

- [codeberg.org/{{ author.username }}.keys](https://codeberg.org/{{ author.username }}.keys)
- [github.com/{{ author.username }}.keys](https://github.com/{{ author.username }}.keys)
- [gitlab.com/{{ author.username }}.keys](https://gitlab.com/{{ author.username }}.keys)
- [meta.sr.ht/~{{ author.username }}.keys](https://meta.sr.ht/~{{ author.username }}.keys)

### authentication

- public key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPaYomkrkg+WhBBuHrrPqCxqB2GRhqmLt5DJzQkjwalD`

### signing

this info is also available at [Codeberg](https://codeberg.org/{{ author.username }}/{{ author.username }}), [GitLab](https://gitlab.com/{{ author.username }}/{{ author.username }}) & [GitHub](https://github.com/{{ author.username }}/{{ author.username }}). all three repositories should be identical and show commits signed with the key below

- public key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFThAK4bQKmz31+wv5lAK5BF1QLf0CT/qhr30iPtmiGT`

for the HTML page, you can [clone the site source](https://github.com/{{ author.username }}/{{ site.host }}) and verify the commit history for [` {{ page.inputPath }} `](https://github.com/{{ author.username }}/{{ site.host }}/tree/main/{{ page.inputPath }}) file

## Matrix

- [@{{ author.social.matrix.username }}:{{ author.social.matrix.envs.host }}](https://matrix.to/#/@{{ author.social.matrix.username }}:{{ author.social.matrix.envs.host }})
  - Cinny Desktop: `EZXJQFNEQT`
  - Element Desktop: `VDLRANHLIM`
  - Element X Android: `HMKZNWCFXJ`
  - FluffyChat Android: `PWXWIELJTV`

- [@{{ author.social.matrix.username }}:{{ author.social.matrix.metropolis.host }}](https://matrix.to/#/@{{ author.social.matrix.username }}:{{ author.social.matrix.metropolis.host }})
  - Element Web: `JodzFErT1w`
  - FluffyChat Android: `Ym5sKH9Qrs`
