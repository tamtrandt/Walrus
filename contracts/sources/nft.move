module 0x0::nft;

use std::string::{Self, String};
use sui::event;
use sui::url::{Self, Url};
use sui::package;
use sui::display;

// ================================
//     ONE-TIME-WITNESS CHUẨN
// ================================
public struct NFT has drop {} // phải cùng tên module viết hoa


// ================================
//          STRUCT NFT
// ================================

public struct TestnetNFT has key, store {
    id: UID,
    name: String,
    description: String,
    url: Url,
}


// ================================
//           EVENTS
// ================================

public struct NFTMinted has copy, drop {
    object_id: ID,
    creator: address,
    name: String,
}


// ================================
//            INIT
// ================================

fun init(w: NFT, ctx: &mut TxContext) {

    let keys = vector[
        b"name".to_string(),
        b"link".to_string(),
        b"image_url".to_string(),
        b"description".to_string(),
        b"project_url".to_string(),
        b"creator".to_string(),
    ];

    let values = vector[
        b"{name}".to_string(),
        b"https://sui-explorer.com/object/{id}".to_string(),
        b"{url}".to_string(),
        b"{description}".to_string(),
        b"https://your-project.xyz".to_string(),
        b"Created on Sui blockchain".to_string(),
    ];

    let publisher = package::claim(w, ctx);

    let mut display = display::new_with_fields<TestnetNFT>(
        &publisher,
        keys,
        values,
        ctx
    );

    display.update_version();

    transfer::public_transfer(publisher, ctx.sender());
    transfer::public_transfer(display, ctx.sender());
}


// ================================
//           VIEW FUNCS
// ================================

public fun name(nft: &TestnetNFT): &String { &nft.name }
public fun description(nft: &TestnetNFT): &String { &nft.description }
public fun url(nft: &TestnetNFT): &Url { &nft.url }


// ================================
//         ENTRY FUNCTIONS
// ================================

public fun mint_to_sender(
    name: String,
    description: String,
    url_str: String,
    ctx: &mut TxContext
) {

    let ascii_url = string::to_ascii(url_str);

    let sender = ctx.sender();

    let nft = TestnetNFT {
        id: object::new(ctx),
        name,
        description,
        url: url::new_unsafe(ascii_url),
    };

    event::emit(NFTMinted {
        object_id: object::id(&nft),
        creator: sender,
        name: nft.name,
    });

    transfer::public_transfer(nft, sender);
}


public fun transfer(nft: TestnetNFT, recipient: address, _: &mut TxContext) {
    transfer::public_transfer(nft, recipient)
}


public fun update_description(
    nft: &mut TestnetNFT,
    new_desc: String,
    _: &mut TxContext
) {
    nft.description = new_desc
}


public fun burn(nft: TestnetNFT, _: &mut TxContext) {
    let TestnetNFT { id, .. } = nft;
    id.delete()
}
