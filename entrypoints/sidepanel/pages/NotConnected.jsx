import React from 'react'
import Header from '../_components/Header'
import Footer from '../_components/Footer'

const NotConnected = ({
    dark,
    auth,
    avatarLabel,
    avatarMenuOpen,
    avatarMenuRef,
    onToggleAvatar,
    onLogout,
    onRefresh,
    onOpenSettings,
    onConnectHandle
}) => {
    return (
        <div className="h-full w-full bg-white dark:bg-gray-900 flex flex-col justify-between items-center">
            <Header
                dark={dark}
                auth={auth}
                avatarLabel={avatarLabel}
                avatarMenuOpen={avatarMenuOpen}
                avatarMenuRef={avatarMenuRef}
                onToggleAvatar={onToggleAvatar}
                onLogout={onLogout}
                onRefresh={onRefresh}
                onOpenSettings={onOpenSettings}
            />
            <main className='flex flex-col items-center justify-center p-4 my-1/2 -translate-y-1/2'>
                <div className="bg-white shadow shadow-gray-300 flex flex-col items-center gap-3 p-4">
                    <img
                        src={dark ? "/not-connected-dark.png" : "/not-connected.png"}
                        alt="DealerCore"
                        className="h-64 w-auto object-contain"
                    />
                    <h4 className='font-bold text-center'>Not Connected</h4>
                    <p className='font-light text-center'>Please log into Facebook and open the Marketplace creation page in a browser tab to use this extension. Keep the tab open while working.</p>
                    <button onClick={() => onConnectHandle((isConnected) => true)} className='bg-[#008BC7] text-white p-2 rounded shadow inline-flex items-center justify-center gap-x-2'>
                        <span></span>
                        <span>Open facebook marketplace</span>
                    </button>
                </div>
            </main>
            <Footer />
        </div>
    )
}

export default NotConnected
