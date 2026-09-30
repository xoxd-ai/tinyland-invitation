{
  description = "@tummycrypt/tinyland-invitation";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };
  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system}; in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [ bazel_8 nodejs_22 (if pkgs ? pnpm_10 then pkgs.pnpm_10 else pkgs.pnpm) ];
          shellHook = ''
            echo "tinyland-invitation dev shell"
            echo "  node $(node --version)"
            echo "  pnpm $(pnpm --version)"
            echo "  bazel $(bazel --version | head -n1)"
          '';
        };
        formatter = pkgs.nixfmt-rfc-style;
      }
    );
}
