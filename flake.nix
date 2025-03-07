{
  description = "virtual environments";

  inputs.devshell.url = "github:numtide/devshell";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs = { self, flake-utils, devshell, nixpkgs }:

    flake-utils.lib.eachDefaultSystem (system: {
      devShell =
        let pkgs = import nixpkgs {
          inherit system;

          overlays = [ devshell.overlays.default ];
        };
        in
        pkgs.devshell.mkShell {
          commands = [
            {
              category = "i18n";
              name = "mkpot";
              help = "Update translation template";
              command = "make i18n";
            }
            {
              category = "i18n";
              name = "mkpo";
              help = "Validate translations";
              command = "make check_i18n";
            }
          ];
          packages = with pkgs; [
            nixpkgs-fmt
            nodejs_20
            ruby
            gnumake
            gettext
            cocoapods
          ];
        };
    });
}
