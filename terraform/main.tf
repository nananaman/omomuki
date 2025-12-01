terraform {
  required_version = ">= 1.0"

  required_providers {
    sakuracloud = {
      source  = "sacloud/sakuracloud"
      version = "2.31.2"
    }
  }
}

provider "sakuracloud" {
  token  = var.sakuracloud_access_key_id
  secret = var.sakuracloud_access_key_secret
  zone   = "is1a"
}
